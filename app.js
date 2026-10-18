const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleString('uk-UA',{dateStyle:'short',timeStyle:'short'});
$('clock').textContent = now();
$('powerTime').textContent = now();
$('alertTime').textContent = now();

const map = L.map('map',{zoomControl:false}).setView([48.7,31.3],5);
L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
 maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
let boundaryLayer=null, helpLayer=L.layerGroup().addTo(map);
const regionNames = {
  'Vinnytsia Oblast':'Вінницька','Volyn Oblast':'Волинська','Dnipropetrovsk Oblast':'Дніпропетровська',
  'Donetsk Oblast':'Донецька','Zhytomyr Oblast':'Житомирська','Zakarpattia Oblast':'Закарпатська',
  'Zaporizhzhia Oblast':'Запорізька','Ivano-Frankivsk Oblast':'Івано-Франківська','Kyiv Oblast':'Київська',
  'Kirovohrad Oblast':'Кіровоградська','Luhansk Oblast':'Луганська','Lviv Oblast':'Львівська',
  'Mykolaiv Oblast':'Миколаївська','Odesa Oblast':'Одеська','Poltava Oblast':'Полтавська',
  'Rivne Oblast':'Рівненська','Sumy Oblast':'Сумська','Ternopil Oblast':'Тернопільська',
  'Kharkiv Oblast':'Харківська','Kherson Oblast':'Херсонська','Khmelnytskyi Oblast':'Хмельницька',
  'Cherkasy Oblast':'Черкаська','Chernivtsi Oblast':'Чернівецька','Chernihiv Oblast':'Чернігівська',
  'Kyiv':'Київ','Sevastopol':'Севастополь','Autonomous Republic of Crimea':'АР Крим'
};
function addRegionOptions(features){
  const select=$('regionSelect'); const found=new Set([...select.options].map(o=>o.value));
  features.forEach(f=>{const name=f.properties?.name_en||f.properties?.name||''; if(name&&!found.has(name)){let o=document.createElement('option');o.value=name;o.textContent=regionNames[name]||name;select.appendChild(o);}});
}
async function loadBoundaries(){
  $('mapStatus').textContent='Загрузка административных границ…';
  const urls=[
    'https://raw.githubusercontent.com/deldeserto/ukraine-geojson/master/oblast.geojson',
    'https://raw.githubusercontent.com/oleksandrg/ukraine_geojson/master/ukraine oblasts.geojson'
  ];
  for(const url of urls){
    try{
      const r=await fetch(url); if(!r.ok)continue;
      const data=await r.json();
      if(!data.features?.length)continue;
      if(boundaryLayer)map.removeLayer(boundaryLayer);
      boundaryLayer=L.geoJSON(data,{style:()=>({color:'#657178',weight:1,fillColor:'#30383c',fillOpacity:.35}),onEachFeature:(f,l)=>{
        const n=f.properties?.name_en||f.properties?.name||'Область';
        l.bindTooltip(regionNames[n]||n,{sticky:true});
        l.on('click',()=>{$('regionSelect').value=n; $('mapStatus').textContent='Выбрана область: '+(regionNames[n]||n)+'. Границы не являются данными о текущей опасности.';});
      }}).addTo(map);
      addRegionOptions(data.features); map.fitBounds(boundaryLayer.getBounds(),{padding:[8,8]});
      $('mapStatus').textContent='Границы загружены. Источник: открытый GeoJSON; время загрузки: '+now()+'.';
      return;
    }catch(e){}
  }
  $('mapStatus').textContent='Не удалось загрузить границы. Проверь интернет; базовая карта остаётся доступной.';
}
$('regionSelect').addEventListener('change',()=>{
 const v=$('regionSelect').value;
 if(!v){map.setView([48.7,31.3],5);return}
 if(boundaryLayer){boundaryLayer.eachLayer(l=>{const n=l.feature.properties?.name_en||l.feature.properties?.name||'';if(n===v)map.fitBounds(l.getBounds(),{padding:[18,18]});});}
});
$('refreshBtn').addEventListener('click',()=>{loadBoundaries();$('powerTime').textContent=now();$('alertTime').textContent=now();});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
 document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===b.dataset.panel));
 if(b.dataset.panel==='mapPanel')setTimeout(()=>map.invalidateSize(),120);
}));
$('operator').addEventListener('change',()=>{$('openPower').textContent=$('operator').value==='dtek'?'Открыть сайт ДТЭК':'Открыть список операторов';});
$('openPower').addEventListener('click',()=>{
 const url=$('operator').value==='dtek'?'https://www.dtek-dnem.com.ua/ua/shutdowns':'https://sies.gov.ua/zvernennya-gromadyan/najbilsh-zapituvana-informaciya/grafiki-vidklyuchen-elektropostachannya-operatoriv-sistemi-rozpodilu';
 window.open(url,'_blank','noopener');
});
const typeMap={
 all:'["amenity"~"charging_station|community_centre|social_centre|shelter"]',
 charging_station:'["amenity"="charging_station"]',
 drinking_water:'["amenity"="drinking_water"]',
 shelter:'["amenity"="shelter"]',
 community_centre:'["amenity"~"community_centre|social_centre"]'
};
$('findHelp').addEventListener('click',async()=>{
 const btn=$('findHelp'); btn.disabled=true;btn.textContent='Ищем…';
 $('helpResults').innerHTML='<p class="muted">Запрос к OpenStreetMap. Данные могут быть неполными.</p>';
 try{
  const tag=typeMap[$('helpType').value];
  const query=`[out:json][timeout:25];area["ISO3166-1"="UA"][admin_level=2]->.ua;(node${tag}(area.ua);way${tag}(area.ua);relation${tag}(area.ua););out center tags 80;`;
  const resp=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
  if(!resp.ok)throw new Error('Источник временно недоступен');
  const data=await resp.json();helpLayer.clearLayers();
  const results=$('helpResults');results.innerHTML='';
  const items=data.elements||[];
  items.forEach(el=>{
   const lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;if(!lat||!lon)return;
   const tags=el.tags||{},name=tags.name||tags.amenity||'Место без названия';
   const marker=L.circleMarker([lat,lon],{radius:6,color:'#173f35',fillColor:'#8ad6bd',fillOpacity:.95,weight:2}).bindPopup(`<b>${escapeHtml(name)}</b><br>Источник: OpenStreetMap<br>Запрос: ${now()}<br><i>Работа и доступность не подтверждены</i>`);
   marker.addTo(helpLayer);
   if(results.children.length<30){
    const d=document.createElement('div');d.className='result';
    d.innerHTML=`<b>${escapeHtml(name)}</b><p class="muted">${escapeHtml(tags.amenity||'Место помощи')} · Источник: OpenStreetMap · Запрос: ${now()}</p><p class="muted">Доступность и часы работы не подтверждены.</p><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}">Открыть на карте ↗</a>`;
    results.appendChild(d);
   }
  });
  if(!items.length)results.textContent='В этом запросе нет результатов. Это не означает, что мест помощи нет.';
  else {const p=document.createElement('p');p.className='muted';p.textContent=`Получено объектов: ${items.length}. Источник: OpenStreetMap/Overpass. Время запроса: ${now()}. Это не подтверждает, что объекты открыты.`;results.prepend(p);map.fitBounds(helpLayer.getBounds(),{padding:[18,18]});}
 }catch(e){$('helpResults').textContent='Не удалось получить данные: '+e.message+'. Попробуйте позже или используйте официальный справочник пунктов помощи.'}
 finally{btn.disabled=false;btn.textContent='Найти места на карте Украины'}
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
loadBoundaries();
