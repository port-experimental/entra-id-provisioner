import { Command } from 'commander';
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
      .name('entra-port')
      .description('CLI to provision Port teams and users from groups and users in Entra Id');

    program
      .command('sync-entra')
      .description('Sync Entra ID groups and users to Port')
      .option('-g, --groups <groups>', 'Comma-separated list of group name regexes to sync')
      .option('-a, --admins <group-name>', 'The entra group name to create admins from')
      .action(async (options) => {
        console.log('Syncing Entra ID data to Port...');
        const groupWhitelist = options.groups ? options.groups.split(',').map(g => g.trim()) : null;
        const adminGroup = options.admins ? options.admins.trim() : null;
        console.log('Group whitelist:', groupWhitelist);
        console.log('Admin group:', adminGroup);
        await syncEntraToPort({
          azureTenantId: AZURE_TENANT_ID,
          azureClientId: AZURE_CLIENT_ID,
          azureClientSecret: AZURE_CLIENT_SECRET,
          groupWhitelist,
          adminGroup
        });
      });

    await program.parseAsync();

  } catch (error) {
    console.error('Error:', error);
  }
}

main();