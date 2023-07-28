import {readFileSync} from 'fs'

const str= readFileSync('/home/mguillon/Downloads/item.geojson', 'utf8')
console.log(`'${str}'`)
JSON.parse(str)
