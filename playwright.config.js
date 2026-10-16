import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:5173',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']},viewport:{width:1440,height:1080}},workers:1,reporter:'list'});
