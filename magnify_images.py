from pathlib import Path
from PIL import Image

def _try_magnify_image(target_dir: Path, file: Path, asset_dir: Path) -> None:
		if file.suffix != ".png":
			return
		relative_path = file.parent.relative_to(target_dir.parent)
		folder = asset_dir / relative_path
		folder.mkdir(exist_ok=True, parents=True)

		print("magnifying: " + file.name)
		img = Image.open(file)
		new_size = (img.size[0]*8, img.size[1]*8)
		img.resize(new_size, Image.Resampling.NEAREST)\
			.save(folder / file.name)
		img.close()

def main():
	ASSET_DIR = Path().resolve() / "assets"
	
	TARGET_DIRS = [Path(i).resolve() for i in [
		"./characters/universal",
		"./characters/engineer"
	]]

	for target_dir in TARGET_DIRS:
		for filepath in target_dir.iterdir():
			if filepath.is_file():
				_try_magnify_image(target_dir, filepath, ASSET_DIR)

if __name__ == "__main__":
	main()