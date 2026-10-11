/** One quantity-owned protective order, never two independent pseudo-OCO legs. */
import { normalizePriceToTick } from '../executor';
import { positive, type Owner } from './contract';
import type { Intent } from './ledger';
import { validateCommand, type PortfolioOrderCommand } from './order-command';

export type ProtectionKind = NonNullable<PortfolioOrderCommand['protection']>['kind'];
export function protectiveCommand(base: PortfolioOrderCommand, owner: Owner, kind: ProtectionKind,
  price: number, tick: number, bid: number, ask: number): PortfolioOrderCommand {
  positive(price, 'protection price'); positive(tick, 'price tick'); positive(bid, 'bid'); positive(ask, 'ask');
  if (!base.reduceOnly || bid > ask) throw new Error('invalid protection base');
  const long = base.positionIdx === 1;
  const up = kind === 'trigger_sl' ? !long : long;
  // Existing main native TP rounds down; maker Sell TP rounds up. SF08 targets
  // keep their prior outward normalization. No silent move to dodge a crossing.
  const direction = owner === 'main' && kind === 'trigger_tp' ? 'down' : up ? 'up' : 'down';
  const normalized = normalizePriceToTick(price, tick, direction);
  positive(normalized, 'normalized protection');
  const reference = long ? bid : ask;
  const correctSide = kind === 'trigger_sl' ? (long ? normalized < reference : normalized > reference)
    : (long ? normalized > reference : normalized < reference);
  if (!correctSide) throw new Error('protection already crossed; requires an explicit owned exit');
  const command: PortfolioOrderCommand = { ...base, orderType: kind === 'maker_tp' ? 'Limit' : 'Market',
    protection: kind === 'maker_tp' ? { kind, price: String(normalized), timeInForce: 'PostOnly' }
      : { kind, price: String(normalized), triggerBy: 'LastPrice', triggerDirection: (kind === 'trigger_tp') === long ? 1 : 2 } };
  validateCommand(command); return command;
}
export function isRestingProtectionStatus(i: Intent, status: string): boolean {
  return !!i.command?.protection && i.cancelRequestedAt === undefined
    && (i.command.protection.kind === 'maker_tp' ? ['New', 'PartiallyFilled'].includes(status) : status === 'Untriggered');
}
