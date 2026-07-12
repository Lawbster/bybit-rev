import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { OperationalIncidentObservation } from "../src/bot/operational-health";
import {
  advanceOperationalIncidentState,
  emptyOperationalWatchdogState,
  markOperationalNotificationAttempted,
  markOperationalNotificationDelivered,
  readOperationalWatchdogState,
  writeOperationalWatchdogState,
} from "../src/bot/operational-watchdog-state";

const warning: OperationalIncidentObservation = {
  key: "context_incomplete",
  severity: "warning",
  summary: "context bad",
  evidence: { actual: 1, expected: 2 },
};

const critical: OperationalIncidentObservation = {
  key: "recovery_mode",
  severity: "critical",
  summary: "recovery active",
  evidence: { owner: "o1" },
};

let now = 1_000;
const state = emptyOperationalWatchdogState(now);

let step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications.length, 0, "warning requires two samples");

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications[0]?.lifecycle, "active");
assert.equal(step.state.incidents[warning.key].pendingLifecycle, "active");
markOperationalNotificationAttempted(state, step.notifications[0], now);

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications.length, 0, "failed delivery retry is bounded");
now += 51_000;
step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications[0]?.lifecycle, "active", "failed delivery retries after one minute");
markOperationalNotificationDelivered(state, step.notifications[0], now);

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications.length, 0, "delivered warning does not spam");

now += 4 * 3600000;
step = advanceOperationalIncidentState({ now, observations: [warning], state });
assert.equal(step.notifications[0]?.lifecycle, "reminder");
markOperationalNotificationDelivered(state, step.notifications[0], now);

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [], state });
assert.equal(step.notifications.length, 0, "clear requires two samples");
now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [], state });
assert.equal(step.notifications[0]?.lifecycle, "cleared");
markOperationalNotificationDelivered(state, step.notifications[0], now);
assert.equal(state.incidents[warning.key].active, false);

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [critical], state });
assert.equal(step.notifications[0]?.lifecycle, "active", "critical activates immediately");
markOperationalNotificationDelivered(state, step.notifications[0], now);

now += 10_000;
step = advanceOperationalIncidentState({
  now,
  observations: [],
  state,
  clearBlockedKeys: new Set([critical.key]),
});
now += 10_000;
step = advanceOperationalIncidentState({
  now,
  observations: [],
  state,
  clearBlockedKeys: new Set([critical.key]),
});
assert.equal(step.notifications.length, 0, "blocked recovery clear remains active");
assert.equal(state.incidents[critical.key].active, true);

now += 10_000;
step = advanceOperationalIncidentState({ now, observations: [], state });
assert.equal(step.notifications[0]?.lifecycle, "cleared");

{
  const escalationState = emptyOperationalWatchdogState(now);
  let escalation = advanceOperationalIncidentState({ now, observations: [warning], state: escalationState });
  escalation = advanceOperationalIncidentState({ now: now + 10_000, observations: [warning], state: escalationState });
  markOperationalNotificationAttempted(escalationState, escalation.notifications[0], now + 10_000);
  escalation = advanceOperationalIncidentState({
    now: now + 20_000,
    observations: [{ ...warning, severity: "critical" }],
    state: escalationState,
  });
  assert.equal(escalation.notifications[0]?.lifecycle, "escalated", "severity escalation bypasses retry delay");
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-watchdog-state-"));
  try {
    const file = path.join(root, "state.json");
    assert.equal(writeOperationalWatchdogState(file, state).success, true);
    const loaded = readOperationalWatchdogState(file, now);
    assert.equal(loaded.incidents[critical.key].active, false);
    fs.writeFileSync(file, "{corrupt");
    assert.deepEqual(readOperationalWatchdogState(file, now).incidents, {});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log("operational watchdog state tests passed");
