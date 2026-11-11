import {mkdir,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);await mkdir(new URL('artifacts/auction-desk-connector/',root),{recursive:true});await cp(new URL('extension/',root),new URL('artifacts/auction-desk-connector/',root),{recursive:true});console.log('Chromeで artifacts/auction-desk-connector を読み込めます');
