import assert from "assert";
import { canExecuteSRPartialAction, SRPartialActionGateInput } from "../src/bot/sr-shadow";

const otherwiseValid: SRPartialActionGateInput = {
  contextHealthy: true,
  hasDecision: true,
  hasRequiredCandidate: true,
  hasPlan: true,
  hasResistance: true,
  depthOk: true,
  remainingDepthOk: true,
  ladderPnlOk: true,
  planProfitOk: true,
  resistanceOk: true,
  keepOk: true,
};

function testHealthyContextAllowsOtherwiseValidAction(): void {
  assert.equal(canExecuteSRPartialAction(otherwiseValid), true);
}

function testUnhealthyContextAloneBlocksOtherwiseValidAction(): void {
  assert.equal(canExecuteSRPartialAction({ ...otherwiseValid, contextHealthy: false }), false);
}

function testExistingGatesRemainRequired(): void {
  for (const key of Object.keys(otherwiseValid) as Array<keyof SRPartialActionGateInput>) {
    if (key === "contextHealthy") continue;
    assert.equal(
      canExecuteSRPartialAction({ ...otherwiseValid, [key]: false }),
      false,
      `${key} must remain a required execution gate`,
    );
  }
}

testHealthyContextAllowsOtherwiseValidAction();
testUnhealthyContextAloneBlocksOtherwiseValidAction();
testExistingGatesRemainRequired();
console.log("S/R context safety tests passed");
