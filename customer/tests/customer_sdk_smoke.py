"""Loads the real pinned SDK, tests storage/session UI, and blocks every live Supabase API request."""
import functools,http.server,pathlib,threading,json,sys
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_port)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    context=browser.new_context()
    context.route('https://neotkiugfgktrjyzrbji.supabase.co/**',lambda route:route.abort())
    page=context.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'/login.html',wait_until='networkidle')
    page.wait_for_selector('#auth-form',timeout=20000)
    assert page.evaluate("typeof window.supabase.createClient")== 'function'
    result=page.evaluate("""async()=>{const c=(await import('./js/services/customer_supabase_client.js')).client();localStorage.setItem('iceflow.customer.remember','no');c.auth.storage.setItem('customer-test-probe','value');const okay=sessionStorage.getItem('customer-test-probe')==='value'&&!localStorage.getItem('customer-test-probe');c.auth.storage.removeItem('customer-test-probe');return okay;}""")
    assert result,'real SDK storage adapter'
    assert not errors,errors
    print('Real pinned Supabase SDK load + customer auth UI + dynamic storage adapter: PASS')
    context.close()
    # These checks use mocks, including inactive logout; remote DB remains blocked.
    for config,path in [({'inactive':True},'dashboard.html'),({},'dashboard.html')]:
        context=browser.new_context()
        context.add_init_script('window.__fixtureConfig='+json.dumps(config))
        context.add_init_script(path=str(root/'tests/customer_mock.js'))
        context.route('**/supabase.js',lambda route:route.fulfill(status=200,body='',content_type='application/javascript'))
        context.route('https://neotkiugfgktrjyzrbji.supabase.co/**',lambda route:route.abort())
        page=context.new_page()
        page.goto(base+'/'+path,wait_until='networkidle')
        if config.get('inactive'):page.locator('#app .empty > .btn.ghost').click()
        else:
            page.locator('#logout').click()
            page.locator('dialog [data-save]').click()
        page.wait_for_url('**/login.html')
        page.wait_for_selector('#auth-form')
        print('Customer logout route: PASS',config)
        context.close()
    browser.close()
server.shutdown()
