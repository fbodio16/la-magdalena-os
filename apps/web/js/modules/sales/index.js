function parseCutMetadata(cut) {
  try {
    const notes = String(cut.notes || '');
    if (!notes.startsWith('LMOS_CUT:')) return {};
    return JSON.parse(notes.slice(9));
  } catch (_error) {
    return {};
  }
}

function normalizeCut(cut) {
  const metadata = parseCutMetadata(cut);
  const rolls = Number(cut.bales || cut.rolls || 0);
  const kg = Number(cut.total_kg || 0);
  return {
    ...cut,
    ...metadata,
    rolls,
    kg,
    weight: rolls ? kg / rolls : Number(metadata.weight || 500),
    batch_code: metadata.batch_code || `CORTE-${String(cut.id || '').slice(0, 6).toUpperCase()}`,
    storage_location: metadata.storage_location || 'Sin asignar',
    stock_movements: Array.isArray(metadata.stock_movements) ? metadata.stock_movements : [],
  };
}

export function createSalesModule({ state, supabase, escapeHtml, openModal, loadData, render }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits = 1) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const cuts = () => state.cuts.map(normalizeCut);
  const sales = () => cuts().flatMap(cut => (cut.stock_movements || [])
    .filter(movement => movement.type === 'Salida' && movement.reason === 'Venta')
    .map(movement => {
      const quantity = Number(movement.quantity || 0);
      const unitPrice = Number(movement.unit_price || 0);
      const tonPrice = Number(movement.ton_price || 0);
      const total = Number(movement.total_amount || (tonPrice > 0 ? (quantity * cut.weight / 1000) * tonPrice : quantity * unitPrice));
      const collected = Number(movement.collected_amount || (movement.payment_status === 'Cobrado' ? total : 0));
      return { ...movement, cut, quantity, unitPrice, tonPrice, total, collected, balance: Math.max(0, total - collected) };
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  function metrics(rows) {
    const total = rows.reduce((sum, sale) => sum + sale.total, 0);
    const collected = rows.reduce((sum, sale) => sum + sale.collected, 0);
    const rolls = rows.reduce((sum, sale) => sum + sale.quantity, 0);
    const tons = rows.reduce((sum, sale) => sum + sale.quantity * sale.cut.weight / 1000, 0);
    return { total, collected, pending: total - collected, rolls, tons };
  }

  function renderPage() {
    const rows = sales();
    const totals = metrics(rows);
    const overdue = rows.filter(sale => sale.due_date && sale.balance > 0 && sale.due_date < new Date().toISOString().slice(0, 10));
    const clients = [...new Set(rows.map(sale => sale.customer).filter(Boolean))];
    return `<div class="page-head"><div><p class="eyebrow">COMERCIALIZACIÓN · 6.2</p><h2>Ventas y cobranzas</h2><p class="muted">Control de entregas, facturación, cobros y saldos por cliente.</p></div><div class="actions"><button class="secondary exportSales">Exportar CSV</button><button class="primary newSale">Nueva venta</button></div></div>
    <div class="metrics"><div class="metric"><span>Ventas registradas</span><b>${money(totals.total)}</b><small>${totals.rolls} rollos · ${number(totals.tons,1)} t</small></div><div class="metric"><span>Cobrado</span><b>${money(totals.collected)}</b><small>${totals.total ? number(totals.collected / totals.total * 100, 1) : '0,0'}% del total</small></div><div class="metric"><span>Saldo pendiente</span><b>${money(totals.pending)}</b><small>${rows.filter(s => s.balance > 0).length} operaciones abiertas</small></div><div class="metric"><span>Vencidas</span><b>${overdue.length}</b><small>${money(overdue.reduce((s,x)=>s+x.balance,0))} pendiente</small></div></div>
    <div class="grid2"><div class="panel"><div class="panel-title"><div><p class="eyebrow">CARTERA</p><h3>Saldos por cliente</h3></div><span class="pill">${clients.length} clientes</span></div>${clients.length ? clients.map(client => { const clientRows=rows.filter(s=>s.customer===client), m=metrics(clientRows); return `<div class="row"><div><b>${escapeHtml(client)}</b><small>${clientRows.length} ventas · ${clientRows.reduce((s,x)=>s+x.quantity,0)} rollos</small></div><div style="text-align:right"><b>${money(m.pending)}</b><small>pendiente</small></div></div>`}).join('') : '<div class="empty">Todavía no hay ventas registradas.</div>'}</div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">ALERTAS</p><h3>Cobranzas a revisar</h3></div><span class="pill">${overdue.length}</span></div>${overdue.length ? overdue.slice(0,8).map(sale=>`<div class="row"><div><b>${escapeHtml(sale.customer||'Cliente sin asignar')}</b><small>Venció ${escapeHtml(sale.due_date)} · ${escapeHtml(sale.cut.batch_code)}</small></div><span class="pill">${money(sale.balance)}</span></div>`).join('') : '<div class="status">No hay cobranzas vencidas.</div>'}</div></div>
    <div class="panel"><div class="panel-title"><div><h3>Operaciones comerciales</h3><small>Trazabilidad desde la partida hasta el cobro</small></div><span class="pill">${rows.length}</span></div>${rows.length ? `<div class="production-table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Partida</th><th>Entrega</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.map(sale=>`<tr><td>${escapeHtml(sale.date||'')}</td><td><b>${escapeHtml(sale.customer||'Sin cliente')}</b><small>${escapeHtml(sale.invoice_number||sale.delivery_note||'Sin comprobante')}</small></td><td>${escapeHtml(sale.cut.batch_code)}</td><td>${sale.quantity} rollos<small>${number(sale.quantity*sale.cut.weight/1000,1)} t</small></td><td>${money(sale.total)}</td><td>${money(sale.collected)}</td><td class="${sale.balance>0?'negative':'positive'}">${money(sale.balance)}</td><td><span class="pill">${escapeHtml(sale.payment_status||'Pendiente')}</span></td><td><button class="secondary saleCollect" data-cut="${sale.cut.id}" data-id="${sale.id}">Cobranza</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No hay ventas registradas.</b><p>Creá la primera venta desde una partida con stock disponible.</p></div>'}</div>`;
  }

  const stockOf = cut => {
    const sold = Number(cut.sold_rolls || 0);
    const balance = (cut.stock_movements || []).reduce((sum,m)=>sum+(m.type==='Ingreso'?Number(m.quantity||0):-Number(m.quantity||0)),0);
    return Math.max(0, cut.rolls - sold + balance);
  };

  function openSaleEditor() {
    const availableCuts = cuts().filter(cut => stockOf(cut) > 0);
    openModal(`<p class="eyebrow">NUEVA OPERACIÓN COMERCIAL</p><h2>Registrar venta de alfalfa</h2><form id="saleForm"><div class="form-grid"><label>Partida<select name="cut_id" required><option value="">Seleccionar</option>${availableCuts.map(c=>`<option value="${c.id}">${escapeHtml(c.batch_code)} · ${stockOf(c)} rollos disponibles</option>`).join('')}</select></label><label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Cliente<input name="customer" list="salesClients" required><datalist id="salesClients">${state.clients.map(c=>`<option value="${escapeHtml(c.name||c.business_name||'')}"></option>`).join('')}</datalist></label><label>Cantidad de rollos<input name="quantity" type="number" min="1" value="1" required></label><label>Precio por rollo<input name="unit_price" type="number" min="0" step="1" value="0"></label><label>Precio por tonelada<input name="ton_price" type="number" min="0" step="1" value="0"></label><label>Condición de pago<select name="payment_terms"><option>Contado</option><option>7 días</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Cuenta corriente</option></select></label><label>Vencimiento<input name="due_date" type="date"></label><label>Factura<input name="invoice_number" placeholder="Opcional"></label><label>Remito<input name="delivery_note" placeholder="Opcional"></label><label>Estado<select name="payment_status"><option>Pendiente</option><option>Parcial</option><option>Cobrado</option></select></label><label>Monto cobrado<input name="collected_amount" type="number" min="0" step="1" value="0"></label><label class="wide">Observaciones<textarea name="notes" rows="3"></textarea></label></div><div id="salePreview" class="status">Seleccione una partida y complete cantidad y precio.</div><button class="primary">Guardar venta</button><p id="saleMsg" class="error hidden"></p></form>`);
    const form=document.querySelector('#saleForm');
    const preview=()=>{const data=new FormData(form),cut=availableCuts.find(c=>c.id===data.get('cut_id')),q=Number(data.get('quantity')||0),u=Number(data.get('unit_price')||0),t=Number(data.get('ton_price')||0),tons=cut?q*cut.weight/1000:0,total=t>0?tons*t:q*u;document.querySelector('#salePreview').innerHTML=`<b>Resumen:</b> ${q} rollos · ${number(tons,1)} t · Total ${money(total)}${cut?` · Stock posterior ${Math.max(0,stockOf(cut)-q)} rollos`:''}`};
    form.oninput=preview; form.onsubmit=saveSale; preview();
  }

  async function saveSale(event) {
    event.preventDefault(); const form=new FormData(event.target),msg=document.querySelector('#saleMsg');
    try {
      const cut=cuts().find(c=>c.id===form.get('cut_id')); if(!cut) throw new Error('Seleccione una partida válida.');
      const quantity=Number(form.get('quantity')||0); if(!(quantity>0)) throw new Error('La cantidad debe ser mayor que cero.'); if(quantity>stockOf(cut)) throw new Error('La venta supera el stock disponible.');
      const unitPrice=Number(form.get('unit_price')||0),tonPrice=Number(form.get('ton_price')||0); if(!(unitPrice>0||tonPrice>0)) throw new Error('Ingrese un precio por rollo o por tonelada.');
      const total=tonPrice>0?(quantity*cut.weight/1000)*tonPrice:quantity*unitPrice; const status=form.get('payment_status'); const collected=status==='Cobrado'?total:Math.min(total,Number(form.get('collected_amount')||0));
      const movement={id:`SALE-${Date.now()}`,type:'Salida',reason:'Venta',quantity,date:form.get('date'),customer:form.get('customer'),storage_location:cut.storage_location,unit_price:unitPrice,ton_price:tonPrice,total_amount:total,payment_terms:form.get('payment_terms'),due_date:form.get('due_date')||'',invoice_number:form.get('invoice_number')||'',delivery_note:form.get('delivery_note')||'',payment_status:status,collected_amount:collected,notes:form.get('notes')||'',created_at:new Date().toISOString()};
      const metadata={...parseCutMetadata(cut),stock_movements:[...(cut.stock_movements||[]),movement]};
      const {error}=await supabase.from('alfalfa_cuts').update({notes:`LMOS_CUT:${JSON.stringify(metadata)}`}).eq('id',cut.id); if(error) throw error;
      document.querySelector('#modalRoot').innerHTML=''; await loadData(); render();
    } catch(error) { msg.textContent=error.message; msg.classList.remove('hidden'); }
  }

  function openCollection(cutId, movementId) {
    const cut=cuts().find(c=>c.id===cutId),movement=cut?.stock_movements?.find(m=>m.id===movementId); if(!cut||!movement)return;
    const total=Number(movement.total_amount||0),collected=Number(movement.collected_amount||0),balance=Math.max(0,total-collected);
    openModal(`<p class="eyebrow">COBRANZA</p><h2>${escapeHtml(movement.customer||'Cliente')}</h2><div class="production-detail-grid"><div><span>Total venta</span><b>${money(total)}</b></div><div><span>Cobrado</span><b>${money(collected)}</b></div><div><span>Saldo</span><b>${money(balance)}</b></div><div><span>Vencimiento</span><b>${escapeHtml(movement.due_date||'Sin fecha')}</b></div></div><form id="collectionForm" style="margin-top:16px"><input type="hidden" name="cut_id" value="${cutId}"><input type="hidden" name="movement_id" value="${movementId}"><div class="form-grid"><label>Nuevo cobro<input name="amount" type="number" min="0" max="${balance}" step="1" value="${balance}" required></label><label>Fecha de cobro<input name="collection_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Medio de pago<select name="payment_method"><option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Depósito</option><option>Compensación</option></select></label><label>Referencia<input name="payment_reference" placeholder="Comprobante / cheque"></label><label class="wide">Notas<textarea name="collection_notes"></textarea></label></div><button class="primary">Registrar cobranza</button><p id="collectionMsg" class="error hidden"></p></form>`);
    document.querySelector('#collectionForm').onsubmit=saveCollection;
  }

  async function saveCollection(event) {
    event.preventDefault(); const form=new FormData(event.target),msg=document.querySelector('#collectionMsg');
    try { const cut=cuts().find(c=>c.id===form.get('cut_id')),index=cut?.stock_movements?.findIndex(m=>m.id===form.get('movement_id')); if(!cut||index<0) throw new Error('No se encontró la venta.'); const movement={...cut.stock_movements[index]},total=Number(movement.total_amount||0),current=Number(movement.collected_amount||0),amount=Number(form.get('amount')||0); if(amount<0||current+amount>total) throw new Error('El cobro supera el saldo pendiente.'); movement.collected_amount=current+amount; movement.payment_status=movement.collected_amount>=total?'Cobrado':movement.collected_amount>0?'Parcial':'Pendiente'; movement.collection_date=form.get('collection_date'); movement.payment_method=form.get('payment_method'); movement.payment_reference=form.get('payment_reference')||''; movement.collection_notes=form.get('collection_notes')||''; const list=[...cut.stock_movements]; list[index]=movement; const metadata={...parseCutMetadata(cut),stock_movements:list}; const {error}=await supabase.from('alfalfa_cuts').update({notes:`LMOS_CUT:${JSON.stringify(metadata)}`}).eq('id',cut.id); if(error)throw error; document.querySelector('#modalRoot').innerHTML=''; await loadData(); render(); } catch(error){msg.textContent=error.message;msg.classList.remove('hidden');}
  }

  function exportCsv() {
    const header=['Fecha','Cliente','Partida','Rollos','Toneladas','Precio por rollo','Precio por tonelada','Total','Cobrado','Saldo','Estado','Vencimiento','Factura','Remito'];
    const rows=sales().map(s=>[s.date,s.customer,s.cut.batch_code,s.quantity,(s.quantity*s.cut.weight/1000).toFixed(2),s.unitPrice,s.tonPrice,s.total,s.collected,s.balance,s.payment_status,s.due_date,s.invoice_number,s.delivery_note]);
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`; const blob=new Blob([`\ufeff${[header,...rows].map(r=>r.map(q).join(';')).join('\n')}`],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ventas_alfalfa_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  function bind() {
    document.querySelectorAll('.newSale').forEach(button=>button.onclick=openSaleEditor);
    document.querySelectorAll('.saleCollect').forEach(button=>button.onclick=()=>openCollection(button.dataset.cut,button.dataset.id));
    document.querySelectorAll('.exportSales').forEach(button=>button.onclick=exportCsv);
  }

  return { renderPage, bind };
}
