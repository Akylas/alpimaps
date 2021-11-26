const parser = require('fast-xml-parser');
const XmlParser = parser.j2xParser;

const fs = require('fs');
const arguments = process.argv ;
console.log(arguments);
const filename = arguments[arguments.length-1];
// const json = JSON.parse(parser.toJson(fs.readFileSync(filename, 'utf-8'),{reversible:true, sanitize:true}));
const options = {
    attributeNamePrefix : '',
    // attrNodeName: '@', //default is false
    attrNodeName: 'attr',
    format:false,
    textNodeName : '#text',
    ignoreAttributes : false,
};
// Intermediate obj
const tObj = parser.getTraversalObj(fs.readFileSync(filename, 'utf-8'),options);
const json = parser.convertToJson(tObj,options);
const groupBy = function(xs, func) {
    return xs.reduce(function(rv, x) {
      (rv[func(x)] = rv[func(x)] || []).push(x);
      return rv;
    }, {});
  };

json.Map.Style.forEach((style, index) =>{
    if (Array.isArray(style.Rule)) {
        const sortedRules = groupBy(style.Rule, s=> s.Filter || '__');
        Object.keys(sortedRules).forEach(k=> {
            let subRules = sortedRules[k];
            if(subRules.length>1) {
                subRules = subRules.sort((a,b) =>  (a.MinScaleDenominator)-(b.MinScaleDenominator) );
                const length = subRules.length;
                for (let index = length-1; index > 0; index--) {
                    if (subRules[index].MinScaleDenominator === subRules[index-1].MaxScaleDenominator) {
                        subRules[index-1].MaxScaleDenominator = subRules[index].MaxScaleDenominator;
                        subRules.splice(index, 1);
                    }
                }
           }
        });

        const newRules = Object.keys(sortedRules).reduce(function(prev, key) {
            return prev.concat(sortedRules[key]);
        },[]);
        style.Rule = newRules;
    }
});


const xmlParser = new XmlParser(options);
const newXML = xmlParser.parse((json));
fs.writeFileSync(filename.replace('.xml', '_new.xml'), newXML);
