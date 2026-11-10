type PrYear={works:string[];equipment:{name:string}[]};
type PrRecord={id:string;title:string;region:string;categories:string[];years:Record<string,PrYear>};

(()=>{
// Реестр есть только на странице всех проектов; на главном экране раздела те же классы,
// но данных и фильтров нет. Обёрток .pr-root на странице несколько (между избранными
// проектами и реестром — блок фотоотчётов): берём ту, где фильтры.
const root=document.querySelector('.pr-filters')?.closest('.pr-root');if(!root)return;
if(!document.getElementById('pr-data'))return;
const list=[...root.querySelectorAll<HTMLElement>('.pr-record')],data: PrRecord[]=JSON.parse(document.getElementById('pr-data')!.textContent!),byId=new Map(data.map(p=>[p.id,p]));
const input=(id: string)=>root.querySelector('#'+id) as HTMLInputElement;let page=1;const size=6;
function matches(p: PrRecord,q: string,category: string,year: string,region: string,work: string){
 const relevant=year?[p.years[year]].filter(Boolean):Object.values(p.years);
 if(!relevant.length)return false;
 if(category&&!p.categories.includes(category))return false;
 if(region&&p.region!==region)return false;
 if(work&&!relevant.some(g=>g.works.includes(work)))return false;
 const hay=[p.id,p.title,p.region,...relevant.flatMap(g=>g.equipment.map(i=>i.name))].join(' ').toLocaleLowerCase('ru');
 return !q||q.split(/\s+/).every(w=>hay.includes(w));
}
function render(){
 const q=input('pr-query').value.toLocaleLowerCase('ru').trim(),cat=input('pr-category').value,year=input('pr-year').value,reg=input('pr-region').value,work=input('pr-work').value;
 const filtered=list.filter(el=>matches(byId.get(el.id)!,q,cat,year,reg,work));const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
 list.forEach(el=>el.hidden=true);filtered.slice((page-1)*size,page*size).forEach(el=>el.hidden=false);
 input('pr-result-count').textContent=filtered.length?`Показано ${(page-1)*size+1}–${Math.min(page*size,filtered.length)} из ${filtered.length} записей`:'Найдено 0 записей';
 input('pr-page').textContent=`Страница ${page} из ${pages}`;input('pr-prev').disabled=page===1;input('pr-next').disabled=page===pages;input('pr-empty').hidden=filtered.length!==0;
}
root.querySelectorAll('.pr-filters input,.pr-filters select').forEach(el=>el.addEventListener('input',()=>{page=1;render()}));
root.querySelector('.pr-filters')!.addEventListener('reset',()=>{setTimeout(()=>{page=1;render()},0)});
input('pr-prev').addEventListener('click',()=>{page--;render();input('registry').scrollIntoView({behavior:'smooth'})});input('pr-next').addEventListener('click',()=>{page++;render();input('registry').scrollIntoView({behavior:'smooth'})});
root.querySelector<HTMLElement>('.pr-pagination')!.hidden=false;render();
})();

export {};
