import sys, zipfile, shutil, os
# nocompress.py file.docx : tell Word never to compress the pictures in this file
src = sys.argv[1]; tmp = src + '.tmp'
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zo:
    for it in zi.infolist():
        data = zi.read(it.filename)
        if it.filename == 'word/settings.xml':
            s = data.decode()
            if 'doNotAutoCompressPictures' not in s:
                s = s.replace('</w:compat>', '</w:compat><w:doNotAutoCompressPictures/>', 1)
                assert 'doNotAutoCompressPictures' in s
            data = s.encode()
        zo.writestr(it, data, compress_type=zipfile.ZIP_STORED if it.filename.startswith('word/media/') else zipfile.ZIP_DEFLATED)
shutil.move(tmp, src); print('ok', os.path.getsize(src))
