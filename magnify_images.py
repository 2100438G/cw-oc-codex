from pathlib import Path
from PIL import Image
import os

data = Path("./characters").resolve()

exclude_dirs_set = ('.')

for dirpath, dirs, files in os.walk(data):
	dirs[:] = [d for d in dirs if not d.startswith(".")]
	for filename in files:
		file = Path(dirpath) / filename
		if file.suffix != ".png":
			continue
		
		
		if not file.with_suffix("").name.endswith('-lrg'):
			print(file)
			img = Image.open(file)
			new_size = (img.size[0]*8, img.size[1]*8)
			img.resize(new_size, Image.Resampling.NEAREST)\
				.save(str(file.with_suffix("")) + "-lrg" + file.suffix)
			img.close()