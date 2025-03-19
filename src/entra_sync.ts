import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { getUser, upsertEntity } from './port_client';

interface SyncConfig {
    azureTenantId: string;
    azureClientId: string;
    azureClientSecret: string;
    groupWhitelist: string[] | null;
    adminGroup: string | null;
}

export async function syncEntraToPort(config: SyncConfig) {
    // Initialize Microsoft Graph client
    const credential = new ClientSecretCredential(
        config.azureTenantId,
        config.azureClientId,
        config.azureClientSecret
    );
    
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default']
    });
    
    const graphClient = Client.initWithMiddleware({
        authProvider
    });
    
    // Fetch groups
    console.log('Fetching groups from Entra ID...');
    let groups = await graphClient
    .api('/groups')
    .select('id,displayName,description,members')
    .get();
    
    let filteredGroups;
    // Filter groups if whitelist is provided
    if (config.groupWhitelist) {
        filteredGroups = groups.value.filter(group => 
            config.groupWhitelist!.some(pattern => new RegExp(pattern).test(group.displayName))
        );
    } else {
        filteredGroups = groups.value;
    }

    // If we have an admin group, let's fetch the members of that group
    let adminGroupMembers = [];
    if (config.adminGroup) {
        const adminGroup = groups.value.find(group => group.displayName === config.adminGroup);
        if (adminGroup) {
            adminGroupMembers = await graphClient.api(`/groups/${adminGroup.id}/members`).get();
        }
    }

    // Create Port teams from groups
    for (const group of filteredGroups) {
        await upsertEntity('_team',
            group.id,
            group.displayName,
            {
                description: group.description || '',
                source: 'entra-id'
            }, {}
        );
        
        // Fetch group members
        const members = await graphClient
        .api(`/groups/${group.id}/members`)
        .get();
        
        // Create Port users from group members
        for (const member of members.value) {
            const teams = [group.id];
            const { entity: existingUser } = await getUser(member.userPrincipalName);
            if (existingUser) {
                teams.push(...existingUser.relations.teams || []);
            }
            await upsertEntity('_user',
                member.userPrincipalName,
                member.displayName,
                {
                    email: member.userPrincipalName,
                    port_role: adminGroupMembers.value.some(admin => admin.userPrincipalName === member.userPrincipalName) ? 'Admin' : 'Member',
                    status: 'Disabled',
                    source: 'entra-id'
                },
                { teams },
            );
        }
    }
}