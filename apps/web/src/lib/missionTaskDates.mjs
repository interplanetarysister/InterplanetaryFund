// Date-time inputs are in the owner's browser timezone. Do not infer a date
// from generated plans, or silently normalize invalid local clock values.
export function localTaskDateToIso(value){
 if(value==="")return null;
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error("Choose a valid local date and time.");
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime())||taskDateInputValue(parsed.toISOString())!==value)throw Error("Choose a valid local date and time.");
 return parsed.toISOString();
}
export function taskDateInputValue(value){
 if(!value)return "";
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return "";
 const pad=n=>String(n).padStart(2,"0");
 return String(d.getFullYear()).padStart(4,"0")+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}
export function validateTaskDueAt(value){
 if(value===null)return null;
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))throw Error("Invalid task due date.");
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString()!==value)throw Error("Invalid task due date.");
 return value;
}
