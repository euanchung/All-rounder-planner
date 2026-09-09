// Search only the consent-filtered directory returned by the server.
export const normalizePeerQuery=value=>String(value??'').normalize('NFKC').replace(/\s+/gu,'').toLocaleLowerCase('ko');
export function matchingPeers(people,query){
 const q=normalizePeerQuery(query);
 return q?(people||[]).filter(p=>[p.name,p.user_id].some(value=>normalizePeerQuery(value).includes(q))):[];
}
