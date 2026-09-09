import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingPeers} from '../src/peer-search.js';
import {peerResults} from '../src/campus-ui.js';
const people=[{name:'홍길동',user_id:'AbC-123',grade:'1',class_name:'2'}];
test('name whitespace and ID case do not prevent matching',()=>{for(const q of ['홍 길동','홍','abc-123','ＡｂＣ'])assert.equal(matchingPeers(people,q).length,1);});
test('blank and unmatched searches stay empty',()=>{for(const q of ['', '  ','없는이름'])assert.deepEqual(matchingPeers(people,q),[]);});
test('hidden searcher sees consent guidance, not directory entries',()=>{assert.doesNotMatch(peerResults({peerQuery:'홍',community:{person:{discoverable:false},people}}),/홍길동|AbC-123/);});
test('public search results and empty guidance are escaped and accurate',()=>{assert.match(peerResults({peerQuery:'홍',community:{person:{discoverable:true},people}}),/홍길동/);assert.match(peerResults({peerQuery:'없음',community:{person:{discoverable:true},people}}),/초기 설정 완료/);assert.doesNotMatch(peerResults({peerQuery:'<',community:{person:{discoverable:true},people:[{name:'<script>',user_id:'a'}]}}),/<script>/);});
