import { Command } from 'commander';
import { upsertEntity, getUsers } from './src/port_client';
import { syncEntraToPort } from './src/entra_sync';

if (process.env.GITHUB_ACTIONS !== 'true') {
    require('dotenv').config();
}

async function main() {
  const PORT_CLIENT_ID = process.env.PORT_CLIENT_ID;
  const PORT_CLIENT_SECRET = process.env.PORT_CLIENT_SECRET;
  const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

  if (!PORT_CLIENT_ID || !PORT_CLIENT_SECRET) {
    console.log('Please provide env vars PORT_CLIENT_ID, PORT_CLIENT_SECRET');
    process.exit(0);
  }

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    console.log('Please provide Azure credentials in env vars: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
    process.exit(0);
  }

  try {
    const program = new Command();

    program
      .name('faker')
      .description('CLI to generte fake data in Port');

    program
      .command('get-users')
      .description('Get all active users in Port')
      .action(async () => {
        // First, let's get all active users in Port (will want to have a jira user each and some issues each)
        const { entities: allUsers } = await getUsers();
        const activeUsers = allUsers.filter((user) => user.properties.status === 'Active');
        console.log(activeUsers);
        return activeUsers;
      });

    program
      .command('sync-entra')
      .description('Sync Entra ID groups and users to Port')
      .option('-g, --groups <groups>', 'Comma-separated list of group name regexes to sync')
      .action(async (options) => {
        console.log('Syncing Entra ID data to Port...');
        const groupWhitelist = options.groups ? options.groups.split(',').map(g => g.trim()) : null;
        console.log('Group whitelist:', groupWhitelist);
        await syncEntraToPort({
          azureTenantId: AZURE_TENANT_ID,
          azureClientId: AZURE_CLIENT_ID,
          azureClientSecret: AZURE_CLIENT_SECRET,
          groupWhitelist
        });
      });

    await program.parseAsync();

  } catch (error) {
    console.error('Error:', error);
  }
}

main();