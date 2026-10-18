export function changedFields(original,corrected,units) {
 if(!corrected)return [];
 const value=(pack,path)=>path.split(".").reduce((v,key)=>v?.[key],pack)??"";
 return [...new Set(units.map(u=>u.path))].flatMap(path=>{
  const before=value(original,path),after=value(corrected,path);
  return before===after?[]:[{path,original:before,replacement:after}];
 });
}
