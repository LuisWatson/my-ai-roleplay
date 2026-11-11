// Runs `next dev -p 3002` in this folder with the Supabase vars set to empty strings, so the app runs without login
// (localStorage only). Used for local checks; see the add-preset-character skill.
const { spawn } = require('child_process');
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' };
const child = spawn('npx', ['next', 'dev', '-p', '3002'], { cwd: __dirname + '/..', env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
