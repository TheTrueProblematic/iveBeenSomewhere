import re

files_to_fix = {
    'AGENTS.md': [
        (r'the 91 locations mentioned', r'the 92 locations mentioned'),
        (r'the 91 places with only', r'the 92 places with only')
    ],
    'README.md': [
        (r'all 91 locations', r'all 92 locations'),
        (r'the 91 song locations', r'the 92 song locations')
    ],
    'src/mockResetBackend.js': [
        (r'length: 91', r'length: 92')
    ],
    'localTests/passwordReset/harness.js': [
        (r'length: 91', r'length: 92')
    ],
    'localTests/passwordReset/integration.emulator.mjs': [
        (r'length: 91', r'length: 92'),
        (r'>86 cannot start', r'>87 cannot start'),
        (r'and >86', r'and >87')
    ],
    'localTests/passwordReset/resetLogic.test.js': [
        (r'upper bound \(86\)', r'upper bound (87)'),
        (r'isEligible\(86\)', r'isEligible(87)'),
        (r'more than 86 places', r'more than 87 places'),
        (r'80–86 visited', r'80–87 visited'),
        (r'80, 83, 86', r'80, 83, 87'),
        (r'80, 86\]', r'80, 87]'),
        (r'eligibility\(91\)', r'eligibility(92)')
    ],
    'localTests/SECURITY_REPORT.md': [
        (r'> 86', r'> 87'),
        (r'80–86', r'80–87'),
        (r'80/86/87', r'80/87/88'),
        (r'the 91 song locations', r'the 92 song locations')
    ]
}

for filepath, replacements in files_to_fix.items():
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(filepath, 'w') as f:
        f.write(content)
