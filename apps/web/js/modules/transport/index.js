function parseTripMetadata(trip) {
  try {
    const notes = String(trip.notes || '');
    if (!notes.startsWith('LMOS_TRIP:')) return { observations: notes };
    return JSON.parse(notes.slice(10));
  } catch (_error) {
    return { observations: String(trip.notes || '') };
  }
}

function normalizeTrip(trip) {
  const meta = parseTripMetadata(trip);
  return {
    ...trip,
    ...meta,
    client_name: meta.client_name || trip.client || '',
    origin: meta.origin || 'Santiago Temple',
    destination: trip.destination || meta.destination || '',
    kilometers: Number(trip.kilometers || 0),
    tons: Number(trip.tons || 0),
    income: Number(trip.income || 0),
    cost: Number(trip.cost || 0),
    fuel_liters: Number(meta.fuel_liters || 0),
    fuel_price: Number(meta.fuel_price || 0),
    tolls: Number(meta.tolls || 0),
    driver_cost: Number(meta.driver_cost || 0),
    maintenance_cost: Number(meta.maintenance_cost || 0),
    other_cost: Number(meta.other_cost || 0),
    cargo: meta.cargo || 'Rollos de alfalfa',
    vehicle: meta.vehicle || 'Scania R450',
    trailer: meta.trailer || 'Semirremolque',
    driver: meta.driver || 'Franco Bodio',
    status: meta.status || 'Planificado',
    payment_status: meta.payment_status || 'Pendiente',
    invoice_number: meta.invoice_number || '',
    observations: meta.observations || '',
  };
}

export function createTransportModule({ state, supabase, escapeHtml, openModal, loadData, render }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const trips = () => state.trips.map(normalizeTrip).sort((a,b)=>String(b.trip_date||'').localeCompare(String(a.trip_date||'')));
  const totalCost = trip => Number(trip.cost || 0) || (trip.fuel_liters*trip.fuel_price + trip.tolls + trip.driver_cost + trip.maintenance_cost + trip.other_cost);
  const margin = trip => trip.income - totalCost(trip);

  function renderPage() {
    const rows = trips();
    const km = rows.reduce((s,x)=>s+x.kilometers,0);
    const tons = rows.reduce((s,x)=>s+x.tons,0);
    const income = rows.reduce((s,x)=>s+x.income,0);
    const costs = rows.reduce((s,x)=>s+totalCost(x),0);
    const fuel = rows.reduce((s,x)=>s+x.fuel_liters,0);
    const completed = rows.filter(x=>x.status==='Completado').length;
    const pendingCollections = rows.filter(x=>x.payment_status!=='Cobrado').reduce((s,x)=>s+x.income,0);
    const table = rows.map(t=>`<tr>
      <td>${escapeHtml(t.trip_date||'—')}</td>
      <td><b>${escapeHtml(t.client_name||'Sin cliente')}</b><small>${escapeHtml(t.origin)} → ${escapeHtml(t.destination||'Sin destino')}</small></td>
      <td>${escapeHtml(t.cargo)}<small>${number(t.tons,1)} t</small></td>
      <td>${number(t.kilometers)} km</td>
      <td>${number(t.fuel_liters,1)} L<small>${t.kilometers?number(t.fuel_liters/t.kilometers*100,1):'0,0'} L/100 km</small></td>
      <td>${money(t.income)}<small>Costo ${money(totalCost(t))}</small></td>
      <td><b class="${margin(t)>=0?'positive':'negative'}">${money(margin(t))}</b></td>
      <td><span class="pill">${escapeHtml(t.status)}</span><small>${escapeHtml(t.payment_status)}</small></td>
      <td><button class="secondary editTrip" data-id="${t.id}">Editar</button></td>
    </tr>`).join('');
    return `<div class="page-head"><div><p class="eyebrow">LOGÍSTICA Y RENTABILIDAD</p><h2>Transporte Enterprise</h2><p class="muted">Viajes propios y de terceros, combustible, costos, cobranzas y margen por operación.</p></div><button class="primary newTrip">+ Registrar viaje</button></div>
      <div class="metrics transport-metrics"><div class="metric"><span>Viajes</span><b>${number(rows.length)}</b><small>${number(completed)} completados</small></div><div class="metric"><span>Kilómetros</span><b>${number(km)}</b><small>${number(tons,1)} toneladas</small></div><div class="metric"><span>Ingresos</span><b>${money(income)}</b><small>Costo ${money(costs)}</small></div><div class="metric"><span>Margen</span><b>${money(income-costs)}</b><small>${income?number((income-costs)/income*100,1):'0,0'}% sobre ingresos</small></div><div class="metric"><span>Combustible</span><b>${number(fuel,1)} L</b><small>${km?number(fuel/km*100,1):'0,0'} L/100 km</small></div><div class="metric"><span>Por cobrar</span><b>${money(pendingCollections)}</b><small>viajes no cobrados</small></div></div>
      <div class="panel"><div class="panel-title"><div><h3>Historial de viajes</h3><p class="muted">Control económico y operativo por viaje.</p></div></div><div class="table-wrap"><table class="table transport-table"><thead><tr><th>Fecha</th><th>Cliente / ruta</th><th>Carga</th><th>Km</th><th>Combustible</th><th>Facturación</th><th>Margen</th><th>Estado</th><th></th></tr></thead><tbody>${table||'<tr><td colspan="9" class="empty">Todavía no hay viajes registrados.</td></tr>'}</tbody></table></div></div>`;
  }

  function tripModal(seed={}) {
    const t=seed.id?normalizeTrip(seed):normalizeTrip(seed);
    openModal(`<p class="eyebrow">TRANSPORTE ENTERPRISE</p><h2>${t.id?'Editar viaje':'Nuevo viaje'}</h2><form id="tripForm"><input type="hidden" name="id" value="${t.id||''}"><div class="form-grid">
      <label>Fecha<input name="trip_date" type="date" value="${t.trip_date||new Date().toISOString().slice(0,10)}" required></label>
      <label>Cliente<input name="client_name" value="${escapeHtml(t.client_name)}" required></label>
      <label>Origen<input name="origin" value="${escapeHtml(t.origin)}" required></label>
      <label>Destino<input name="destination" value="${escapeHtml(t.destination)}" required></label>
      <label>Carga<input name="cargo" value="${escapeHtml(t.cargo)}"></label>
      <label>Toneladas<input name="tons" type="number" step="0.01" value="${t.tons||0}"></label>
      <label>Kilómetros totales<input name="kilometers" type="number" step="1" value="${t.kilometers||0}"></label>
      <label>Ingreso del viaje<input name="income" type="number" step="1" value="${t.income||0}"></label>
      <label>Litros de combustible<input name="fuel_liters" type="number" step="0.1" value="${t.fuel_liters||0}"></label>
      <label>Precio por litro<input name="fuel_price" type="number" step="0.01" value="${t.fuel_price||0}"></label>
      <label>Peajes<input name="tolls" type="number" step="1" value="${t.tolls||0}"></label>
      <label>Chofer / viáticos<input name="driver_cost" type="number" step="1" value="${t.driver_cost||0}"></label>
      <label>Mantenimiento imputado<input name="maintenance_cost" type="number" step="1" value="${t.maintenance_cost||0}"></label>
      <label>Otros costos<input name="other_cost" type="number" step="1" value="${t.other_cost||0}"></label>
      <label>Camión<input name="vehicle" value="${escapeHtml(t.vehicle)}"></label>
      <label>Semirremolque<input name="trailer" value="${escapeHtml(t.trailer)}"></label>
      <label>Chofer<input name="driver" value="${escapeHtml(t.driver)}"></label>
      <label>Estado<select name="status">${['Planificado','En viaje','Completado','Cancelado'].map(v=>`<option ${t.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Estado de cobro<select name="payment_status">${['Pendiente','Facturado','Cobrado'].map(v=>`<option ${t.payment_status===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Factura / comprobante<input name="invoice_number" value="${escapeHtml(t.invoice_number)}"></label>
      <label class="wide">Observaciones<textarea name="observations">${escapeHtml(t.observations)}</textarea></label>
    </div><div class="actions"><button class="primary">Guardar viaje</button>${t.id?'<button type="button" class="danger deleteTrip">Eliminar</button>':''}</div><p id="tripMsg" class="error hidden"></p></form>`);
    document.querySelector('#tripForm').onsubmit=saveTrip;
    const del=document.querySelector('.deleteTrip'); if(del)del.onclick=()=>deleteTrip(t.id);
  }

  async function saveTrip(event) {
    event.preventDefault();
    const f=new FormData(event.target), id=f.get('id');
    const meta={client_name:f.get('client_name'),origin:f.get('origin'),cargo:f.get('cargo'),fuel_liters:Number(f.get('fuel_liters')||0),fuel_price:Number(f.get('fuel_price')||0),tolls:Number(f.get('tolls')||0),driver_cost:Number(f.get('driver_cost')||0),maintenance_cost:Number(f.get('maintenance_cost')||0),other_cost:Number(f.get('other_cost')||0),vehicle:f.get('vehicle'),trailer:f.get('trailer'),driver:f.get('driver'),status:f.get('status'),payment_status:f.get('payment_status'),invoice_number:f.get('invoice_number'),observations:f.get('observations')};
    const computedCost=meta.fuel_liters*meta.fuel_price+meta.tolls+meta.driver_cost+meta.maintenance_cost+meta.other_cost;
    const row={company_id:state.companyId,trip_date:f.get('trip_date'),client:f.get('client_name'),destination:f.get('destination'),kilometers:Number(f.get('kilometers')||0),tons:Number(f.get('tons')||0),income:Number(f.get('income')||0),cost:computedCost,notes:`LMOS_TRIP:${JSON.stringify(meta)}`};
    const result=id?await supabase.from('transport_trips').update(row).eq('id',id):await supabase.from('transport_trips').insert(row);
    if(result.error){const m=document.querySelector('#tripMsg');m.textContent=result.error.message;m.classList.remove('hidden');return}
    document.querySelector('#modalRoot').innerHTML='';await loadData();render();
  }

  async function deleteTrip(id){if(!confirm('¿Eliminar este viaje?'))return;const {error}=await supabase.from('transport_trips').delete().eq('id',id);if(error)return alert(error.message);document.querySelector('#modalRoot').innerHTML='';await loadData();render()}

  function bind(){document.querySelectorAll('.newTrip').forEach(b=>b.onclick=()=>tripModal());document.querySelectorAll('.editTrip').forEach(b=>b.onclick=()=>tripModal(state.trips.find(t=>t.id===b.dataset.id)||{}))}
  return {renderPage,bind,openEditor:tripModal};
}
