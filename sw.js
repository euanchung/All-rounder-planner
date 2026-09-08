// Notification display only. Never cache authenticated data or intercept requests.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let p={};try{p=event.data?.json()||{};}catch{}event.waitUntil(self.registration.showNotification('메타시간표',{body:p.body||'새 소식이 있어요.',icon:'/favicon.svg',tag:p.tag||'campus-news',data:{url:['/#social','/#home'].includes(p.url)?p.url:'/#social'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=['/#social','/#home','/#planner'].includes(event.notification.data?.url)?event.notification.data.url:'/#social';event.waitUntil(self.clients.openWindow(url));});
