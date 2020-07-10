import svgSlimming from 'svg-slimming/svg-slimming.js';
import * as fs from 'fs';
import * as path from 'path';

const iconsPath = './osm_icons';
const icons = fs.readdirSync(iconsPath).filter(s =>s.endsWith('.svg')).filter(s => !s.endsWith('_filtered.svg'));
console.log('icons', icons);
Promise.all(
    icons.map(icon => {
        const svgcode = fs.readFileSync(path.join(iconsPath, icon));
        console.error(' slimming', icon)
        return svgSlimming(svgcode).then(result => {
            console.log('svgSlimming done', icon);
            fs.writeFileSync(path.join(iconsPath, icon).replace('.svg', '_filtered.svg'), result);
            console.log('svgSlimming done1', icon);
        }).catch(err=>{
            console.error('error slimming', icon, err)
        });
    })
);
