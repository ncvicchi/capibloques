"""Independent ZIP/CRC/SHA validation and extraction of synthetic CI fixtures only."""
import hashlib
import json
import pathlib
import zipfile

root = pathlib.Path('.idf-ci').resolve()
for profile in ('main', 'auxiliary', 'lcd1602', 'lcd2004', 'ssd1306', 'ili9341', 'ili9488'):
    with zipfile.ZipFile(root / f'{profile}.zip') as archive:
        assert archive.testzip() is None, profile
        names = archive.namelist()
        assert len(names) == len(set(names)) and len(names) <= 64
        for entry in archive.infolist():
            parts = pathlib.PurePosixPath(entry.filename).parts
            assert parts[0] == 'capibloques' and '..' not in parts and not entry.is_dir()
            assert entry.date_time == (1980, 1, 1, 0, 0, 0)
        manifest = json.loads(archive.read('capibloques/manifest.json'))
        assert manifest['framework'] == 'esp-idf' and manifest['frameworkVersion'] == '5.5.5'
        assert manifest['chip'] == 'esp32'
        expected = {f'capibloques/{path}' for path in manifest['sources']} | {'capibloques/manifest.json'}
        assert set(names) == expected
        for name, digest in manifest['sources'].items():
            assert hashlib.sha256(archive.read(f'capibloques/{name}')).hexdigest() == digest
        destination = root / 'from-zip' / profile
        destination.mkdir(parents=True, exist_ok=True)
        archive.extractall(destination)
        print(f'{profile}: ZIP CRC, deterministic timestamps, source SHA-256 and extraction passed')
