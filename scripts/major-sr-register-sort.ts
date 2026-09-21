/** Viewer-only enhancement. No map calculations or changes to archived renderers. */
import assert from 'assert/strict';

export interface RegisterRow {id:string;cells:string[]}
export function registerSortValue(row:RegisterRow,column:number):string|number|null {
  const c=row.cells;
  switch(column){
    case 0:return `${c[0]}T${c[3]}:00Z`;
    case 1:return Number(c[1]);
    case 2:return c[2];
    case 3:return c[3];
    case 4:return Number.parseFloat(c[4]); // Numeric lower bound, not formatted text.
    case 5:return c[5];
    case 6:return c[6]==='Active at cutoff'?null:Date.parse(c[6].replace(' ','T')+':00Z');
    default:throw Error('Unknown register column');
  }
}
export function compareRegisterRows(a:RegisterRow,b:RegisterRow,column:number,direction:1|-1):number {
  const x=registerSortValue(a,column),y=registerSortValue(b,column);
  // A missing retirement date stays last in either direction.
  if(x===null&&y!==null)return 1;
  if(x!==null&&y===null)return -1;
  const cmp=x===y?0:x!<y!?-1:1;
  return cmp*direction || a.cells[0].localeCompare(b.cells[0]) ||
    a.cells[3].localeCompare(b.cells[3]) || a.id.localeCompare(b.id);
}

// Supplied by the existing standalone chart's classic script.
declare let render:()=>void;
export function installRegisterSorting():void {
  const rows=document.getElementById('rows') as HTMLTableSectionElement;
  const table=rows.closest('table')!;
  const headers=Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
  const labels=headers.map(th=>th.textContent!.trim());
  let column=1,direction:1|-1=-1; // Initial order: price high -> low.
  const style=document.createElement('style');
  style.textContent='.register-sort{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;padding:5px 0;margin:0;font:inherit;font-weight:600;cursor:pointer}.register-sort:hover{color:#fff;background:#2a3d52}.register-sort:focus-visible{outline:2px solid #88c8ff;outline-offset:3px}.register-sort-indicator{min-width:1em;color:#88c8ff}';
  document.head.append(style);
  const note=document.createElement('p');note.className='note';note.id='register-sort-help';
  note.textContent='Click a column heading to sort; click again to reverse. Bounds sort by lower price. Active (no retirement date) stays last.';
  table.parentElement!.before(note);table.setAttribute('aria-describedby',note.id);
  const buttons=headers.map((th,index)=>{
    const button=document.createElement('button');button.type='button';button.className='register-sort';button.dataset.column=String(index);
    const label=document.createElement('span');label.textContent=labels[index];
    const icon=document.createElement('span');icon.className='register-sort-indicator';icon.setAttribute('aria-hidden','true');
    button.append(label,icon);th.replaceChildren(button);
    button.onclick=()=>{direction=index===column?(direction===1?-1:1):(index===1?-1:1);column=index;sortRows();};
    return button;
  });
  function sortRows(){
    const list=Array.from(rows.rows).map(node=>({node,id:node.dataset.id!,cells:Array.from(node.cells).map(td=>td.textContent!.trim())}));
    list.sort((a,b)=>compareRegisterRows(a,b,column,direction));
    rows.replaceChildren(...list.map(r=>r.node)); // Keep row click handlers/selection intact.
    headers.forEach((th,index)=>{
      const active=index===column,nextDirection=active?(direction===1?'descending':'ascending'):(index===1?'descending':'ascending');
      th.setAttribute('aria-sort',active?(direction===1?'ascending':'descending'):'none');
      buttons[index].querySelector('.register-sort-indicator')!.textContent=active?(direction===1?'▲':'▼'):'↕';
      buttons[index].setAttribute('aria-label',labels[index]+': sort '+nextDirection);
      buttons[index].title='Sort '+nextDirection;
    });
  }
  const originalRender=render;
  render=()=>{originalRender();sortRows();}; // Filters, as-of time and row clicks retain sort.
  // These listeners captured the old function directly; arrow callbacks already
  // resolve the updated render binding when called.
  for(const [id,event] of [['search','oninput'],['activeOnly','onchange'],['start','onchange']] as const){
    const element=document.getElementById(id)!;
    if(element[event]===originalRender)element[event]=render;
  }
  sortRows();
}

export function withSortableRegister(html:string):string {
  assert(html.endsWith('</html>'));
  assert(!html.includes('id="register-sorting"'),'Sorting already installed');
  const script=`<script id="register-sorting">\n${registerSortValue.toString()}\n${compareRegisterRows.toString()}\n(${installRegisterSorting.toString()})();\n</script>`;
  return html.slice(0,-7)+script+'</html>';
}
