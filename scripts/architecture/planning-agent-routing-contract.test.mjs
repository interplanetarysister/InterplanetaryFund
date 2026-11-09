import test from 'node:test';
import assert from 'node:assert/strict';
import { routePlanningAgent } from './planning-agent-routing-contract.mjs';
test('strategy and growth remain separately flagged',()=>{
 assert.equal(routePlanningAgent('/api/strategy/report',{IFUND_STRATEGY_ENABLED:'true'})?.capability,'strategy');
 assert.equal(routePlanningAgent('/api/growth/report',{IFUND_STRATEGY_ENABLED:'true'}),null);
 assert.equal(routePlanningAgent('/api/growth/report',{IFUND_GROWTH_ENABLED:'true'})?.capability,'growth');
});
test('all routes fail closed by default',()=>assert.equal(routePlanningAgent('/api/strategy/report'),null));
test('no payments, send, OAuth or cross-namespace dispatch',()=>{
 const flags={IFUND_STRATEGY_ENABLED:'true',IFUND_GROWTH_ENABLED:'true'};
 for (const path of ['/api/payments/webhook','/api/oauth/callback','/api/communications/send','/api/strategy','/api/growth']) assert.equal(routePlanningAgent(path,flags),null);
});
test('composite route metadata never grants send or write privileges',()=>{
 const route=routePlanningAgent('/api/growth/report',{IFUND_GROWTH_ENABLED:'true'});
 assert.equal(route.authorizationRequired,true);
 assert.equal(route.writeOrSendAllowed,false);
 assert.equal(Object.isFrozen(route),true);
});
