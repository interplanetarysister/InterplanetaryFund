import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/supabase';
import { Loading, CampaignCard } from '../components/UI';
function MyCampaigns({ user }) { const [items,setItems]=useState(null);useEffect(()=>{if(!db||!user)return;db.from('ifund_campaigns').select('*').eq('owner_id',user.id).order('created_at',{ascending:false}).then(({data})=>setItems(data||[]));},[user]);return <main><h1>My campaigns</h1><Link className="primary" to="/create">Create campaign</Link><div className="cards">{items?.map(c=><div key={c.id}><CampaignCard c={c}/><Link to={'/edit/'+c.id}>Edit campaign</Link></div>)||<Loading/>}</div></main>; }
export default MyCampaigns;
