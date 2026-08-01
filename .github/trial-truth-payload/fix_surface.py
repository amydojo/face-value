from pathlib import Path

path = Path('src/features/trial-truth/TrialTruthSurface.module.css')
source = path.read_text()
needle = '  pointer-events: none;\n'
if source.count(needle) != 1:
    raise RuntimeError(f'Expected one disabled pointer declaration, found {source.count(needle)}')
path.write_text(source.replace(needle, ''))
