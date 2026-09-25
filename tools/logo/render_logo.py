import os, asyncio, base64, sys, json
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__))
async def render(salidas):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--disable-background-networking"])
        pg=await b.new_page()
        await pg.goto(f'file://{D}/pagina.html'); await pg.evaluate("document.fonts.load('500 126px Montserrat')"); await pg.evaluate('document.fonts.ready')
        for nombre,op in salidas:
            data=await pg.evaluate("async o=>{const c=document.getElementById('c'); await dibujarLogo(c,o); return c.toDataURL('image/png')}",op)
            open(nombre,'wb').write(base64.b64decode(data.split(',')[1]))
        await b.close()
if __name__=='__main__':
    asyncio.run(render(json.loads(sys.argv[1])))
