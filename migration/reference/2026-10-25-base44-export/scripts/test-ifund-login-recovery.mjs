import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {safeAuthErrorMessage,safeLoginFailureByStatus} from '../src/lib/safe-auth-error.js';

const get=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const file of ['src/App.jsx','src/lib/AuthContext.jsx','src/pages/Login.jsx']){
  const r=ts.transpileModule(get(file),{
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
    reportDiagnostics:true,
  });
  assert.equal(r.diagnostics?.length||0,0,file+' must compile');
}
assert.equal(safeAuthErrorMessage('login').includes('Unable'),true);
assert.match(safeLoginFailureByStatus(401),/check your email and password/);
assert.equal(safeLoginFailureByStatus(403),safeLoginFailureByStatus(401));
assert.match(safeLoginFailureByStatus(429),/Too many/);
assert.match(safeLoginFailureByStatus(502),/temporarily unavailable/);
assert.match(safeLoginFailureByStatus(null),/connection/i);

const app=get('src/App.jsx');
assert.match(app,/path="\/login" element=\{<Login/);
assert.match(app,/path="\/activate" element=\{<DeviceActivation/);
assert.match(app,/path="\/devices" element=\{<ConnectedDevices/);
assert.match(app,/encodeURIComponent\(pathname \+ search \+ hash\)/);
assert.doesNotMatch(app,/navigateToLogin\(\)/,'Expired sessions must not redirect the entire app away from its own login page');

const auth=get('src/lib/AuthContext.jsx');
assert.match(auth,/if \(error.status === 401 \|\| error.status === 403\)/);
assert.match(auth,/localStorage\.removeItem\('base44_access_token'\)/);
assert.match(auth,/localStorage\.removeItem\('token'\)/);
assert.match(auth,/window\.location\.reload\(\)/);
assert.doesNotMatch(auth.slice(auth.indexOf('if (error.status === 401 || error.status === 403)'),auth.indexOf('} else {',auth.indexOf('if (error.status === 401 || error.status === 403)'))).replace(/\/\/[^\n]*/g, ''),/base44\.auth\.logout/);

const login=get('src/pages/Login.jsx');
assert.match(login,/fetch\(path,/);
assert.match(login,/CapacitorHttp\.post/);
assert.match(login,/https:\/\/interplanetaryfund\.base44\.app/);
assert.match(login,/credentials: "same-origin"/);
assert.match(login,/cache: "no-store"/);
assert.match(login,/response\.status/);
assert.match(login,/base44\.auth\.setToken\(result\.access_token\)/);
assert.match(login,/window\.location\.assign\(returnTo\)/);
assert.match(login,/role="alert"/);
assert.doesNotMatch(login,/base44\.auth\.loginViaEmailPassword\(/,
  'The SDK redirects to server logout on rejected passwords; IFund login must not');
assert.doesNotMatch(login,/error\.message|err\.message|setError\(err/);
assert.doesNotMatch(login,/localStorage|sessionStorage/,
  'Never persist credentials in Login component');
globalThis.window={location:{origin:'https://interplanetaryfund.com',search:'?returnTo=%2Factivate%3Fcode%3DABCDE-12345'}};
const {safeReturnTo}=await import('../src/lib/authReturnTo.js');
assert.equal(safeReturnTo(),'/activate?code=ABCDE-12345');
globalThis.window.location.search='?returnTo=https%3A%2F%2Fmalicious.example%2F';
assert.equal(safeReturnTo(),'/dashboard');
globalThis.window.location.search='?returnTo=%2Fdevices';
assert.equal(safeReturnTo(),'/devices');
console.log('PASS: IFund login preserves device approval, safely handles expired sessions and invalid credentials without provider logout redirects.');
