import sys
from PIL import Image
# zs.py NAME Hcss "file@ycss" ...   frames 1568x772 of a 1277x718 css viewport -> width 1564
K=772/718
name,H,*parts=sys.argv[1:]; H=float(H)
out=Image.new('RGB',(1372,round(H*K)),'white')
for p in parts:
    f,y=p.split('@'); im=Image.open(f).convert('RGB').crop((0,0,1372,772)); out.paste(im,(0,round(float(y)*K)))
out=out.resize((1564,round(out.height*1564/1372)),Image.LANCZOS)
p=f'/mnt/user-data/outputs/shots/{name}.png'; out.save(p,optimize=True); print(p,out.size)
