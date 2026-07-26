export function createIntegrationModule({state,escapeHtml,number,money,render,setPage}){
  const today=()=>new Date().toISOString().slice(0,10);
  const activeCampaign=()=>state.campaigns.find(c=>c.status==='Activa')||state.campaigns[0]||null;
  const stockAvailable=()=>state.cuts.reduce((sum,c)=>sum+Number(c.bales||c.rolls||0),0)-state.stockMovements.filter(m=>m.movement_type==='Salida').reduce((s,m)=>s+Number(m.quantity||0),0);
  const pendingSales=()=>state.salesOrders.filter(s=>s.status!=='Anulada'&&Number(s.total_amount||0)>Number(s.paid_amount||0));
  const overdueTasks=()=>state.workTasks.filter(t=>!['Completada','Cancelada'].includes(t.status)&&t.due_date<today());
  const lowInventory=()=>state.inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.minimum_stock||0));
  const readinessChecks=()=>[
    {key:'company',label:'Empresa activa',ok:Boolean(state.companyId),detail:state.companies.find(c=>c.id===state.companyId)?.name||'Sin empresa'},
    {key:'lots',label:'Lotes configurados',ok:state.lots.length>0,detail:`${state.lots.length} lotes`},
    {key:'campaign',label:'Campaña creada',ok:state.campaigns.length>0,detail:activeCampaign()?.name||'Sin campaña'},
    {key:'production',label:'Producción conectada',ok:Array.isArray(state.cuts),detail:`${state.cuts.length} cortes`},
    {key:'stock',label:'Stock trazable',ok:Array.isArray(state.stockMovements),detail:`${Math.max(0,stockAvailable())} rollos disponibles`},
    {key:'clients',label:'Clientes maestros',ok:state.clients.length>0,detail:`${state.clients.length} clientes`},
    {key:'resources',label:'Recursos operativos',ok:state.equipment.length>0&&state.personnel.length>0,detail:`${state.equipment.length} equipos · ${state.personnel.length} personas`},
    {key:'security',label:'Auditoría y seguridad',ok:true,detail:'Auditoría instalada'},
    {key:'backup',label:'Respaldo disponible',ok:true,detail:'Exportación JSON habilitada'}
  ];
  const score=()=>{const c=readinessChecks();return Math.round(c.filter(x=>x.ok).length/c.length*100)};
  const pageFor={lots:'lots',campaign:'campaigns',production:'production',stock:'production',clients:'clients',resources:'resources',security:'data-safety',backup:'data-safety',company:'saas'};

  function renderPage(){
    const checks=readinessChecks();
    const pct=score();
    const campaign=activeCampaign();
    const pending=pendingSales();
    const due=overdueTasks();
    const low=lowInventory();
    const produced=state.cuts.reduce((s,c)=>s+Number(c.bales||c.rolls||0),0);
    const sales=state.salesOrders.filter(s=>s.status!=='Anulada').reduce((s,x)=>s+Number(x.total_amount||0),0);
    const collected=state.salesOrders.filter(s=>s.status!=='Anulada').reduce((s,x)=>s+Number(x.paid_amount||0),0);
    const transportMargin=state.trips.reduce((s,t)=>s+Number(t.income||0)-Number(t.cost||0),0);
    return `<div class="hero"><div><p class="eyebrow">ENTERPRISE 2026 · INTEGRACIÓN OPERATIVA</p><h2>Centro de puesta en marcha</h2><p>Verifica que producción, stock, ventas, transporte, recursos y seguridad funcionen como un único sistema.</p></div><div class="hero-kpi"><b>${pct}%</b><span>preparación operativa</span></div></div>
    <div class="kpi-grid">
      <article class="kpi"><span>CAMPAÑA ACTIVA</span><b>${escapeHtml(campaign?.name||'Sin definir')}</b><small>${campaign?.status||'Configuración pendiente'}</small></article>
      <article class="kpi"><span>PRODUCCIÓN</span><b>${number(produced)} rollos</b><small>${state.cuts.length} cortes registrados</small></article>
      <article class="kpi"><span>STOCK DISPONIBLE</span><b>${number(Math.max(0,stockAvailable()))}</b><small>rollos trazables</small></article>
      <article class="kpi"><span>VENTAS / COBROS</span><b>${money(sales)}</b><small>${money(collected)} cobrados</small></article>
      <article class="kpi"><span>MARGEN LOGÍSTICO</span><b>${money(transportMargin)}</b><small>${state.trips.length} viajes</small></article>
    </div>
    <div class="two-col">
      <section class="panel"><div class="section-head"><div><p class="eyebrow">CONTROL DE HABILITACIÓN</p><h3>Lista de verificación</h3></div><span class="pill ${pct===100?'success':''}">${pct}%</span></div>
        <div class="checklist">${checks.map(c=>`<button class="check-row integrationGo" data-page="${pageFor[c.key]||'dashboard'}"><span class="check-icon ${c.ok?'ok':'pending'}">${c.ok?'✓':'!'}</span><span><b>${escapeHtml(c.label)}</b><small>${escapeHtml(c.detail)}</small></span><span>›</span></button>`).join('')}</div>
      </section>
      <section class="panel"><p class="eyebrow">FLUJO INTEGRADO</p><h3>Circuito operativo</h3>
        <div class="flow-list">
          ${[['1','Campaña y lotes','campaigns'],['2','Corte y partida','production'],['3','Stock y movimientos','production'],['4','Venta y cobranza','sales'],['5','Viaje y entrega','transport'],['6','Resultado económico','finance']].map(x=>`<button class="flow-step integrationGo" data-page="${x[2]}"><span>${x[0]}</span><div><b>${x[1]}</b><small>Abrir módulo</small></div><strong>→</strong></button>`).join('')}
        </div>
      </section>
    </div>
    <div class="three-col">
      <section class="panel"><p class="eyebrow">ALERTAS OPERATIVAS</p><h3>${due.length} tareas vencidas</h3><p class="muted">${due.length?due.slice(0,3).map(t=>escapeHtml(t.title)).join(' · '):'No hay tareas vencidas.'}</p><button class="secondary integrationGo" data-page="establishment">Abrir agenda</button></section>
      <section class="panel"><p class="eyebrow">CUENTAS POR COBRAR</p><h3>${pending.length} operaciones</h3><p class="muted">Saldo: ${money(pending.reduce((s,x)=>s+Number(x.total_amount||0)-Number(x.paid_amount||0),0))}</p><button class="secondary integrationGo" data-page="sales">Abrir cobranzas</button></section>
      <section class="panel"><p class="eyebrow">INVENTARIO</p><h3>${low.length} artículos críticos</h3><p class="muted">${low.length?low.slice(0,3).map(i=>escapeHtml(i.name)).join(' · '):'Stock por encima del mínimo.'}</p><button class="secondary integrationGo" data-page="establishment">Abrir inventario</button></section>
    </div>
    <section class="panel"><div class="section-head"><div><p class="eyebrow">PRUEBA DE PUNTA A PUNTA</p><h3>Validación antes de datos reales</h3></div><button id="exportReadiness" class="secondary">Exportar diagnóstico CSV</button></div>
      <p class="muted">Completá una operación ficticia: corte → stock → venta → cobro → viaje. Luego verificá que el Dashboard, el Centro de Decisiones y el Flujo de Fondos reflejen el resultado.</p>
      <div class="actions"><button class="primary integrationGo" data-page="production">Comenzar prueba</button><button class="secondary integrationGo" data-page="data-safety">Crear respaldo</button></div>
    </section>`;
  }

  function exportReadiness(){
    const rows=[['control','estado','detalle'],...readinessChecks().map(c=>[c.label,c.ok?'OK':'PENDIENTE',c.detail])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`diagnostico_lmos_${today()}.csv`;a.click();URL.revokeObjectURL(a.href);
  }
  function bind(){
    document.querySelectorAll('.integrationGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    const exp=document.querySelector('#exportReadiness');if(exp)exp.onclick=exportReadiness;
  }
  return {renderPage,bind};
}
