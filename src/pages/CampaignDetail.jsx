import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/supabase';
import { Loading, Message } from '../components/UI';
function Detail() { const { id } = useParams(); const [c,setC]=useState(null); const [error,setError]=useState(''); useEffect(()=>{if(!db)return;db.from('ifund_campaigns').select('*').eq('id',id).single().then(({data,error:e})=>{setC(data);setError(e?.message||'');});},[id]);return <main><Message error>{error}</Message>{!c ? <Loading/> : <article className="detail"><small>{c.category} · {c.status}</small><h1>{c.title}</h1>{c.cover_image_url&&<img className="cover" src={c.cover_image_url} alt="Campaign cover"/>}<p className="lede">{c.summary}</p><div className="card"><h3>Funding goal</h3><strong>${Number(c.goal_amount||0).toLocaleString()}</strong><p>Contribute through a verified payment destination when one is connected. This preview does not process payments.</p></div><p className="story">{c.story}</p></article>}</main>; }
export default Detail;
