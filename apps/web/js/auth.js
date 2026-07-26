import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL='https://grlifamrkdoffglvrttu.supabase.co'
const SUPABASE_KEY='sb_publishable_NlFza1aVKzhWh2Xiwm0VGQ_wI1aPdTN'
const sb=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
const $=selector=>document.querySelector(selector)
const form=$('#loginForm'), button=$('#loginBtn'), message=$('#loginMsg'), state=$('#connectionState')

function showMessage(text,ok=false){
  message.textContent=text
  message.classList.remove('hidden')
  message.style.background=ok?'#e8f7ee':'#ffeaea'
  message.style.color=ok?'#126047':'#9b2525'
}
function setBusy(busy){
  button.disabled=busy
  button.textContent=busy?'Ingresando…':'Ingresar'
}
async function withTimeout(promise,ms=15000){
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('La conexión tardó demasiado. Revisá internet y volvé a intentar.')),ms))])
}

form.addEventListener('submit',async event=>{
  event.preventDefault()
  event.stopImmediatePropagation()
  message.classList.add('hidden')
  const email=$('#email').value.trim(), password=$('#password').value
  if(!email||!password){showMessage('Completá el correo y la contraseña.');return}
  setBusy(true)
  try{
    const {data,error}=await withTimeout(sb.auth.signInWithPassword({email,password}))
    if(error)throw error
    if(!data?.session)throw new Error('Supabase no devolvió una sesión válida.')
    showMessage('Ingreso correcto. Abriendo LA MAGDALENA OS…',true)
    setTimeout(()=>location.reload(),250)
  }catch(error){
    const raw=String(error?.message||error)
    const friendly=/invalid login credentials/i.test(raw)?'Correo o contraseña incorrectos.':raw
    showMessage(friendly)
    setBusy(false)
  }
},{capture:true})

try{
  const {error}=await withTimeout(sb.from('companies').select('id',{count:'exact',head:true}),10000)
  if(error)throw error
  state.textContent='✓ Supabase conectado. Login listo.'
  state.style.background='#e8f7ee';state.style.color='#126047'
}catch(error){
  state.textContent='No se pudo comprobar Supabase: '+String(error?.message||error)
  state.style.background='#ffeaea';state.style.color='#9b2525'
}
