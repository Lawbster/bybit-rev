/** On-demand, file-only status. No credentials, exchange calls or daemon. */
import { portfolioStatusFromDisk } from './portfolio/commander';
if (require.main === module) console.log(portfolioStatusFromDisk());
