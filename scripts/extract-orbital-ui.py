"""Extract the 3x2 generated sheets; keep originals unchanged.
Requires Pillow, NumPy and SciPy. Bounds are measured from connected alpha
silhouettes, not painted backgrounds. No color replacement or AI redraw.
"""
from pathlib import Path
import json
from PIL import Image
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
SHEETS=ROOT/'art/ui/orbital-holo/sheets'
OUT=ROOT/'src/sprites/ui'
GROUPS={
 '01-panels':['panel','panel_dark','panel_holo','title','dock','card'],
 '02-controls':['button_primary','button_secondary','button_success','button_disabled','tab_on','tab_off'],
 '03-navigation':['projector','galaxy','camp','lab','stars','missions'],
 '04-board':['tile_light','tile_dark','tile_locked','slot','tile_selected','tile_reward'],
}
manifest=[]
for group,names in GROUPS.items():
 im=Image.open(SHEETS/(group+'.png')).convert('RGBA'); w,h=im.size
 for i,name in enumerate(names):
  col,row=i%3,i//3
  cell=im.crop((round(col*w/3),round(row*h/2),round((col+1)*w/3),round((row+1)*h/2)))
  a=np.asarray(cell)[:,:,3]
  labs,n=ndimage.label(a>100)
  counts=np.bincount(labs.ravel()); counts[0]=0
  obj=ndimage.find_objects(labs)[int(counts.argmax())-1]
  yy,xx=obj
  box=(max(0,xx.start-2),max(0,yy.start-2),min(cell.width,xx.stop+2),min(cell.height,yy.stop+2))
  cut=cell.crop(box)
  cut.thumbnail((320,320),Image.Resampling.LANCZOS)
  path=OUT/('oh_'+name+'.webp');cut.save(path,'WEBP',quality=92,method=6)
  manifest.append({'id':'oh_'+name,'sheet':group+'.png','cell':i+1,'crop':box,'size':cut.size})
(ROOT/'art/ui/orbital-holo/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Extracted',len(manifest),'sprites; original sheets preserved.')
