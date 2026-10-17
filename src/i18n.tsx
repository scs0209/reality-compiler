import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'en' | 'ko';

const en = {
  'app.title': 'Reality Compiler',
  'app.tagline': '— Compile room photos into executable spatial graphs with epistemic uncertainty',
  'app.subtagline':
    'Outputs actionable reality data (3D epistemic volumes, ±cm error bars, moving bottlenecks) instead of decorative 3D meshes',
  'app.pill.sentry': 'Sentry Agent Tracing',
  'app.pill.sentryOff': 'Sentry: not sending',
  'app.pill.sentryUnknown': 'Sentry: status unknown',
  'app.pill.entire': 'Entire CLI Tracked',
  'kpi.objects': 'Objects detected',
  'kpi.relations': 'Spatial relationships',
  'kpi.relations.none': 'no relations in this graph',
  'kpi.confidence': 'Model confidence',
  'kpi.confidence.short': 'self-reported',
  'kpi.confidence.note': 'Reported by the model about itself. It is not a measure of physical accuracy.',
  'kpi.unresolved': '{n} unresolved',
  'status.scene.compiled': 'Compiled · {model}',
  'status.scene.fallback': 'Fallback sample',
  'status.scene.sample': 'Hand-authored sample',
  'status.gemma.ready': 'Ollama ready, model installed',
  'status.gemma.nomodel': 'Ollama is up but the model is not installed',
  'status.gemma.offline': 'Ollama is not reachable',
  'status.atlas.connected': 'MongoDB Atlas',
  'status.atlas.memory': 'Atlas: memory only',
  'status.unknown': 'status unknown',
  'panel.source': 'Source & Evidence',
  'panel.inspector': 'Scene Inspector',
  'panel.objects': 'Detected objects ({n})',
  'panel.stages': 'Compile stages',
  'panel.unresolved': 'Unresolved observations',
  'panel.legend': 'Evidence status',
  'stage.preflight': 'Preflight check',
  'stage.inference': 'Gemma inference',
  'stage.assemble': 'Validate & assemble',
  'stage.save': 'Save RoomGraph',
  'stage.fallback': 'Fallback to sample',
  'stage.none': 'No compile ran: this is a hand-authored sample.',
  'unresolved.none': 'No blind spots reported.',
  'legend.observed': 'Directly visible',
  'legend.inferred': 'Partly hidden or prior-based',
  'legend.occluded': 'Blind spot, deduced',
  'insp.tab.props': 'Properties',
  'insp.tab.relations': 'Relations',
  'insp.tab.evidence': 'Evidence',
  'insp.tab.data': 'Data',
  'insp.empty': 'Select an object in the list or on the canvas to inspect it.',
  'insp.category': 'Category',
  'insp.position': 'Position (cm)',
  'insp.rotation': 'Rotation',
  'insp.dimensions': 'Dimensions (cm)',
  'insp.confidence': 'Confidence',
  'insp.status': 'Evidence status',
  'insp.uncertainty': 'Uncertainty',
  'insp.uncertainty.value': '±{pos} cm position · ±{dim} cm size',
  'insp.movable': 'Movable',
  'insp.weight': 'Est. weight',
  'insp.disassembly': 'Needs disassembly',
  'insp.yes': 'yes',
  'insp.no': 'no',
  'insp.relations.title': 'Relationships ({n})',
  'insp.relations.none': 'No relations involve this object.',
  'insp.evidence.source': 'Evidence source',
  'insp.evidence.region': 'Source region',
  'insp.evidence.box': 'Box: x {x}%, y {y}%, {w}% × {h}%',
  'insp.evidence.noRegion': 'No photo region for this object: it was added for the what-if, or the model gave no usable box.',
  'app.lang.toggle': '한국어',
  'app.section.evidence': 'Photo or sample room',
  'app.btn.upload': 'Upload Photo',
  'app.calib.title': 'Scale Reference (Calibration Anchor)',
  'app.btn.recompile': 'Re-Compile RoomGraph with Gemma 3',
  'app.btn.compiling': 'Compiling with Gemma 3 (gemma3:4b)...',
  'app.section.epistemic': '2. Epistemic Classification (Observed vs Inferred)',
  'app.meanConf': 'Mean Conf: {pct}%',
  'app.filter.all': 'All ({n})',
  'app.filter.obs': 'Obs ({n})',
  'app.filter.inf': 'Inf ({n})',
  'app.filter.occ': 'Occ ({n})',
  'app.size': 'Size: {w}×{d}×{h}cm · Uncertainty: ±{u}cm',
  'app.selected': 'Selected:',
  'app.rotateTitle': 'Rotate 90 degrees',
  'app.removeTitle': 'Remove Object',
  'app.toast.uploaded': 'Compiled "{name}" into RoomGraph v1.2!',
  'app.toast.sample': 'Loaded sample room "{name}" (hand-authored, not compiled from a photo).',
  'app.toast.fallback': 'Gemma could not compile this photo. Showing a sample room instead (see the warning).',
  'app.toast.compileFailed': 'Compile failed: {reason}',
  'app.btn.recompileHint': 'Upload a photo first. Sample rooms are hand-authored and cannot be compiled.',
  'app.compiling.note': 'Gemma 3 is reading your photo. On local hardware this can take a minute or more.',
  'app.fallback.title': 'Gemma compile failed: this is a sample room, NOT your photo',
  'app.fallback.body': 'Reason ({stage}): {reason}',
  'partner.sentry.sampleNote': 'This is a hand-authored sample, so no compile ran and there is no trace.',
  'partner.sentry.fallbackNote': 'Fallback ({stage}): {reason}',
  'evidence.na': 'n/a',
  'app.toast.added': 'Added {name}. Switch to 2D Blueprint to drag or 3D Volumes to inspect!',
  'app.toast.reset': 'Reset to initial compiled layout.',
  'app.toast.saved': 'Upserted current RoomGraph to MongoDB Atlas (roomgraphs collection).',
  'app.toast.loaded': 'Loaded "{title}" from MongoDB Atlas.',

  'state.on': 'ON',
  'state.off': 'OFF',

  'badge.observed': 'OBSERVED',
  'badge.inferred': 'INFERRED',
  'badge.occluded': 'OCCLUDED',

  'canvas.mode3d': '3D Epistemic Volumes',
  'canvas.mode2d': '2D Metric Blueprint',
  'canvas.hint3d': 'Drag empty space to orbit · drag an object to move it · scroll to zoom',
  'canvas.3d.aria': '3D view of the room. Drag empty space to orbit, drag an object to move it.',
  'canvas.resetView': 'Reset view',
  'canvas.3d.loading': 'Loading the 3D view…',
  'canvas.hint2d': 'Drag to Move · 90° Rotate',
  'canvas.shell': '±cm Uncertainty Shell',
  'canvas.relationEdges': 'Relation Edges',
  'canvas.rotate90': 'Rotate 90°',
  'canvas.why.title': 'Why 3D Epistemic Volumes instead of a photogrammetry mesh?',
  'canvas.why.p1': 'Decorative 3D meshes hallucinate smooth surfaces over occluded corners. Here,',
  'canvas.why.p2': 'objects render as solid metric volumes while',
  'canvas.why.p3': '&',
  'canvas.why.p4': 'items expose their outer',
  'canvas.why.p5': 'wireframe uncertainty shells.',
  'canvas.why.obs': 'Observed',
  'canvas.why.inf': 'Inferred',
  'canvas.why.occ': 'Occluded',
  'canvas.inject': 'Inject What-If Furniture:',
  'canvas.add.king': '+ King Bed (180×208cm)',
  'canvas.add.sofa': '+ 3-Seater Sofa (210×98cm)',
  'canvas.add.washer': '+ WashTower (70×74cm)',
  'canvas.add.shelf': '+ 5-Tier Shelf (80×32cm)',
  'canvas.svg.envelope': '3D Room Envelope: {w}×{d}×{h}cm (±{u}cm)',
  'canvas.svg.north': 'North Wall: {w}cm (±{u}cm)',
  'canvas.svg.west': 'West Wall: {d}cm',
  'canvas.svg.blindSpot': 'Blind Spot #{n} ({risk})',
  'canvas.legend.observed': 'Observed:',
  'canvas.legend.observedDesc': 'Solid volume · Direct corner visibility',
  'canvas.legend.inferred': 'Inferred:',
  'canvas.legend.inferredDesc': 'Dashed volume · Perspective/prior + ±cm shell',
  'canvas.legend.occluded': 'Occluded Prior:',
  'canvas.legend.occludedDesc': 'Dotted volume · Blind-spot deduction',
  'canvas.legend.door': 'Blue Arc = Door Swing Clearance',

  'whatif.kicker': 'Downstream #1 · Moving & Layout What-If Verifier',
  'whatif.title': 'Move-In & Clearance Feasibility (with ±cm Epistemic Error)',
  'whatif.score': 'Confidence Score:',
  'whatif.reset': 'Reset Layout',
  'whatif.nominal': 'Nominal Geometry:',
  'whatif.pass': 'PASS (Fits Cleanly)',
  'whatif.blocked': 'BLOCKED (Collision)',
  'whatif.nominalDesc': 'Evaluated using central Gemma 3 dimensions without error bars',
  'whatif.worst': 'Worst-Case (±cm Bounds):',
  'whatif.safe': 'SAFE MARGIN',
  'whatif.collision': 'UNCERTAINTY COLLISION!',
  'whatif.worstDesc': 'Evaluated when Inferred / Occluded ±cm error bands compound',
  'whatif.doorWidth': 'Target Entry Door Width',
  'whatif.door.walkup': '68cm (Walk-up)',
  'whatif.door.standard': '82cm (Standard)',
  'whatif.door.wide': '105cm (Wide)',
  'whatif.walkway': 'Min Walkway Clearance',
  'whatif.walk.tight': '40cm (Tight)',
  'whatif.walk.standard': '55cm (Standard)',
  'whatif.walk.ada': '85cm (ADA/Wide)',
  'whatif.alerts': 'Detected Constraints & Epistemic Alerts ({n})',
  'whatif.clickHighlight': 'Click to highlight object',
  'whatif.allPass':
    'All furniture passes both Nominal geometry and ±cm Epistemic Uncertainty bounds!',
  'whatif.matrix': 'Doorway ({w}cm) Pass-Through Matrix',
  'whatif.th.object': 'Object',
  'whatif.th.cross': 'Min Cross-Section',
  'whatif.th.error': 'Error Band',
  'whatif.th.status': 'Status',
  'whatif.status.pass': 'PASS',
  'whatif.status.tight': 'TIGHT (±cm Risk)',
  'whatif.status.blocked': 'DISASSEMBLE / HOIST',
  'whatif.tabpfn.title': 'Moving Quote & Volume Estimate (rule-based, from RoomGraph)',
  'whatif.tabpfn.partner': 'Rule-based estimate',
  'whatif.tabpfn.volume': 'Volume / Weight',
  'whatif.tabpfn.truck': 'Truck & Crew',
  'whatif.tabpfn.crew': '({n} crew)',
  'whatif.tabpfn.quote': 'Quote (P50 / P90)',

  'partner.tab.json': 'RoomGraph JSON',
  'partner.tab.sentry': 'Sentry Trace',
  'partner.tab.atlas': 'MongoDB Atlas ({n})',
  'partner.tab.entire': 'Entire CLI Session',
  'partner.json.schema': 'Schema: {v} · Nodes: {n} · Edges: {e}',
  'partner.json.copy': 'Copy JSON',
  'partner.json.copied': 'Copied',
  'partner.json.csv': 'Manifest CSV',
  'partner.sentry.model': 'Model:',
  'partner.sentry.runtime': 'Runtime:',
  'partner.sentry.latency': 'Latency: {ms} ms',
  'partner.sentry.tokens': 'Tokens: {total} ({p}p + {c}c)',
  'partner.sentry.waterfall':
    'Agent span waterfall (measured by this app; sent to Sentry only when SENTRY_DSN is set)',
  'partner.sentry.notSending':
    'Not sent to Sentry: this compile was not traced by Sentry (SENTRY_DSN is not set on the server). The spans below are measured by this app only.',
  'partner.sentry.delivery': 'Sentry delivery: {sent} sent, {failed} failed',
  'partner.sentry.deliveryError': 'Last error: {error}',
  'partner.atlas.placeholder': 'Search MongoDB Atlas (furniture label, observed/inferred, title)...',
  'partner.atlas.saving': 'Saving to Atlas...',
  'partner.atlas.upsert': 'Upsert RoomGraph to Atlas',
  'partner.atlas.sceneId': 'sceneId: {id} · {w}×{d}cm · {n} objects',
  'partner.atlas.load': 'Load Scene',
  'partner.entire.title':
    'Entire CLI Active (`.entire/settings.json` + `entire-session/devrelay-session.json`)',
  'partner.entire.body':
    'Git hooks and checkpoints are tracked via Entire CLI (`entire status` / `entire checkpoint list`), documenting why we built epistemic 3D/2D uncertainty volumes instead of hallucinated photogrammetry meshes.',
  'partner.entire.cp1.label': '[Checkpoint #1 — Schema Design]',
  'partner.entire.cp1.body':
    'Single-image 3D surface meshes hallucinate over occluded corners and create false precision. We designed roomgraph.v1.2 so every object carries epistemic: observed | inferred | occluded_prior and explicit ±cm error bands.',
  'partner.entire.cp2.label': '[Checkpoint #2 — Gemma 3 Vision Prompt]',
  'partner.entire.cp2.body':
    'gemma3:4b first calibrates pixel-to-cm scale against a standard door frame (210×82cm) before extracting 2D bboxes, 3D bounding volumes, and blind spots.',
  'partner.entire.cp3.label': '[Checkpoint #3 — 3D Epistemic Volumes & Solver]',
  'partner.entire.cp3.body':
    'Added interactive 3D Epistemic Volumes + 2D Blueprint toggle, flagging UNCERTAINTY_OVERFLOW when two items pass nominally (2cm gap) but collide under ±12cm combined uncertainty.',

  'evidence.title': 'Source Evidence Photo (Gemma 3 Vision BBox & Epistemic State)',
  'evidence.overlay': 'Vision Overlay',
  'evidence.scale': 'Scale Anchor:',
  'evidence.pxcm': 'px/cm:',
  'evidence.tilt': 'Tilt:',
  'evidence.scaleConf': 'Scale Conf:',
};

export type TranslationKey = keyof typeof en;

const ko: Record<TranslationKey, string> = {
  'app.title': '리얼리티 컴파일러',
  'app.tagline': '— 방 사진을 인식 불확실성을 포함한 실행 가능한 공간 그래프로 컴파일',
  'app.subtagline':
    '장식용 3D 메시 대신 실행 가능한 현실 데이터(3D 인식 볼륨, ±cm 오차 막대, 이사 병목 구간)를 출력합니다',
  'app.pill.sentry': 'Sentry 에이전트 트레이싱',
  'app.pill.sentryOff': 'Sentry: 전송 안 함',
  'app.pill.sentryUnknown': 'Sentry: 상태 알 수 없음',
  'app.pill.entire': 'Entire CLI 추적 중',
  'kpi.objects': '감지된 객체',
  'kpi.relations': '공간 관계',
  'kpi.relations.none': '이 그래프에는 관계가 없습니다',
  'kpi.confidence': '모델 신뢰도',
  'kpi.confidence.short': '자체 보고',
  'kpi.confidence.note': '모델이 스스로 보고한 값이며, 실제 물리적 정확도를 뜻하지 않습니다.',
  'kpi.unresolved': '미확정 {n}개',
  'status.scene.compiled': '컴파일됨 · {model}',
  'status.scene.fallback': '폴백 샘플',
  'status.scene.sample': '직접 작성한 샘플',
  'status.gemma.ready': 'Ollama 준비됨, 모델 설치됨',
  'status.gemma.nomodel': 'Ollama는 켜져 있지만 모델이 설치되지 않음',
  'status.gemma.offline': 'Ollama에 연결할 수 없음',
  'status.atlas.connected': 'MongoDB Atlas',
  'status.atlas.memory': 'Atlas: 메모리만',
  'status.unknown': '상태 알 수 없음',
  'panel.source': '소스와 증거',
  'panel.inspector': '장면 인스펙터',
  'panel.objects': '감지된 객체 ({n})',
  'panel.stages': '컴파일 단계',
  'panel.unresolved': '미확정 관찰',
  'panel.legend': '증거 상태',
  'stage.preflight': '사전 점검',
  'stage.inference': 'Gemma 추론',
  'stage.assemble': '검증 및 조립',
  'stage.save': 'RoomGraph 저장',
  'stage.fallback': '샘플로 폴백',
  'stage.none': '컴파일이 실행되지 않았습니다: 직접 작성한 샘플입니다.',
  'unresolved.none': '보고된 사각지대가 없습니다.',
  'legend.observed': '직접 보임',
  'legend.inferred': '일부 가려짐 또는 사전 지식 기반',
  'legend.occluded': '사각지대, 추정',
  'insp.tab.props': '속성',
  'insp.tab.relations': '관계',
  'insp.tab.evidence': '증거',
  'insp.tab.data': '데이터',
  'insp.empty': '목록이나 캔버스에서 객체를 선택하면 자세히 볼 수 있습니다.',
  'insp.category': '분류',
  'insp.position': '위치 (cm)',
  'insp.rotation': '회전',
  'insp.dimensions': '크기 (cm)',
  'insp.confidence': '신뢰도',
  'insp.status': '증거 상태',
  'insp.uncertainty': '불확실성',
  'insp.uncertainty.value': '위치 ±{pos}cm · 크기 ±{dim}cm',
  'insp.movable': '이동 가능',
  'insp.weight': '추정 무게',
  'insp.disassembly': '분해 필요',
  'insp.yes': '예',
  'insp.no': '아니오',
  'insp.relations.title': '관계 ({n})',
  'insp.relations.none': '이 객체와 관련된 관계가 없습니다.',
  'insp.evidence.source': '증거 출처',
  'insp.evidence.region': '사진 속 위치',
  'insp.evidence.box': '박스: x {x}%, y {y}%, {w}% × {h}%',
  'insp.evidence.noRegion': '이 객체는 사진 속 위치가 없습니다: what-if로 추가했거나 모델이 쓸 수 있는 박스를 주지 않았습니다.',
  'app.lang.toggle': 'English',
  'app.section.evidence': '사진 또는 샘플 방',
  'app.btn.upload': '사진 업로드',
  'app.calib.title': '축척 기준 (캘리브레이션 앵커)',
  'app.btn.recompile': 'Gemma 3로 RoomGraph 다시 컴파일',
  'app.btn.compiling': 'Gemma 3로 컴파일 중 (gemma3:4b)...',
  'app.section.epistemic': '2. 인식 분류 (관측 vs 추론)',
  'app.meanConf': '평균 신뢰도: {pct}%',
  'app.filter.all': '전체 ({n})',
  'app.filter.obs': '관측 ({n})',
  'app.filter.inf': '추론 ({n})',
  'app.filter.occ': '가려짐 ({n})',
  'app.size': '크기: {w}×{d}×{h}cm · 불확실성: ±{u}cm',
  'app.selected': '선택됨:',
  'app.rotateTitle': '90도 회전',
  'app.removeTitle': '객체 삭제',
  'app.toast.uploaded': '"{name}" 파일을 RoomGraph v1.2로 컴파일했습니다!',
  'app.toast.sample': '샘플 방 "{name}"을(를) 불러왔습니다 (직접 작성한 샘플이며 사진에서 컴파일한 것이 아닙니다).',
  'app.toast.fallback': 'Gemma가 이 사진을 컴파일하지 못해 샘플 방을 대신 표시합니다 (경고 문구 참고).',
  'app.toast.compileFailed': '컴파일 실패: {reason}',
  'app.btn.recompileHint': '먼저 사진을 업로드하세요. 샘플 방은 직접 작성한 것이라 컴파일할 수 없습니다.',
  'app.compiling.note': 'Gemma 3가 사진을 분석하는 중입니다. 로컬 환경에서는 1분 이상 걸릴 수 있습니다.',
  'app.fallback.title': 'Gemma 컴파일 실패: 아래는 샘플 방이며 업로드한 사진이 아닙니다',
  'app.fallback.body': '원인 ({stage}): {reason}',
  'partner.sentry.sampleNote': '직접 작성한 샘플이라 컴파일이 실행되지 않았고 트레이스도 없습니다.',
  'partner.sentry.fallbackNote': '폴백 ({stage}): {reason}',
  'evidence.na': '해당 없음',
  'app.toast.added': '{name} 추가됨. 2D 도면에서 드래그하거나 3D 볼륨에서 확인하세요!',
  'app.toast.reset': '초기 컴파일 레이아웃으로 재설정했습니다.',
  'app.toast.saved': '현재 RoomGraph를 MongoDB Atlas(roomgraphs 컬렉션)에 저장했습니다.',
  'app.toast.loaded': 'MongoDB Atlas에서 "{title}"을(를) 불러왔습니다.',

  'state.on': '켜짐',
  'state.off': '꺼짐',

  'badge.observed': '관측됨',
  'badge.inferred': '추론됨',
  'badge.occluded': '가려짐',

  'canvas.mode3d': '3D 인식 볼륨',
  'canvas.mode2d': '2D 미터법 도면',
  'canvas.hint3d': '빈 곳을 드래그해 회전 · 객체를 드래그해 이동 · 스크롤로 확대/축소',
  'canvas.3d.aria': '방의 3D 보기. 빈 곳을 드래그하면 회전하고 객체를 드래그하면 이동합니다.',
  'canvas.resetView': '시점 초기화',
  'canvas.3d.loading': '3D 보기를 불러오는 중…',
  'canvas.hint2d': '드래그로 이동 · 90° 회전',
  'canvas.shell': '±cm 불확실성 쉘',
  'canvas.relationEdges': '관계 에지',
  'canvas.rotate90': '90° 회전',
  'canvas.why.title': '포토그래메트리 메시 대신 3D 인식 볼륨을 쓰는 이유는?',
  'canvas.why.p1': '장식용 3D 메시는 가려진 모서리 위에 매끄러운 표면을 환각처럼 만들어냅니다. 여기서는',
  'canvas.why.p2': '객체는 솔리드 미터법 볼륨으로 렌더링되고, 반면',
  'canvas.why.p3': '&',
  'canvas.why.p4': '항목은 바깥',
  'canvas.why.p5': '와이어프레임 불확실성 쉘을 노출합니다.',
  'canvas.why.obs': '관측됨',
  'canvas.why.inf': '추론됨',
  'canvas.why.occ': '가려짐',
  'canvas.inject': 'What-If 가구 배치:',
  'canvas.add.king': '+ 킹 침대 (180×208cm)',
  'canvas.add.sofa': '+ 3인용 소파 (210×98cm)',
  'canvas.add.washer': '+ 워시타워 (70×74cm)',
  'canvas.add.shelf': '+ 5단 선반 (80×32cm)',
  'canvas.svg.envelope': '3D 방 외곽: {w}×{d}×{h}cm (±{u}cm)',
  'canvas.svg.north': '북쪽 벽: {w}cm (±{u}cm)',
  'canvas.svg.west': '서쪽 벽: {d}cm',
  'canvas.svg.blindSpot': '사각지대 #{n} ({risk})',
  'canvas.legend.observed': '관측:',
  'canvas.legend.observedDesc': '솔리드 볼륨 · 모서리 직접 관측',
  'canvas.legend.inferred': '추론:',
  'canvas.legend.inferredDesc': '점선 볼륨 · 원근/사전 확률 + ±cm 쉘',
  'canvas.legend.occluded': '가려진 사전 추정:',
  'canvas.legend.occludedDesc': '점선 볼륨 · 사각지대 추론',
  'canvas.legend.door': '파란 호 = 문 여닫이 여유 공간',

  'whatif.kicker': '다운스트림 #1 · 이사 & 배치 What-If 검증기',
  'whatif.title': '입주 & 여유 공간 실현 가능성 (±cm 인식 오차 포함)',
  'whatif.score': '신뢰도 점수:',
  'whatif.reset': '레이아웃 초기화',
  'whatif.nominal': '명목 기하:',
  'whatif.pass': '통과 (깔끔하게 맞음)',
  'whatif.blocked': '차단 (충돌)',
  'whatif.nominalDesc': '오차 막대 없이 Gemma 3 중심 치수로 평가',
  'whatif.worst': '최악의 경우 (±cm 범위):',
  'whatif.safe': '안전 여유',
  'whatif.collision': '불확실성 충돌!',
  'whatif.worstDesc': '추론·가려진 객체의 ±cm 오차 범위가 누적될 때 평가',
  'whatif.doorWidth': '목표 출입문 폭',
  'whatif.door.walkup': '68cm (계단식 아파트)',
  'whatif.door.standard': '82cm (표준)',
  'whatif.door.wide': '105cm (넓음)',
  'whatif.walkway': '최소 통로 여유',
  'whatif.walk.tight': '40cm (빠듯함)',
  'whatif.walk.standard': '55cm (표준)',
  'whatif.walk.ada': '85cm (ADA/넓음)',
  'whatif.alerts': '감지된 제약 & 인식 경고 ({n})',
  'whatif.clickHighlight': '클릭하면 객체 강조',
  'whatif.allPass': '모든 가구가 명목 기하와 ±cm 인식 불확실성 범위를 모두 통과합니다!',
  'whatif.matrix': '출입구 ({w}cm) 통과 매트릭스',
  'whatif.th.object': '객체',
  'whatif.th.cross': '최소 단면',
  'whatif.th.error': '오차 범위',
  'whatif.th.status': '상태',
  'whatif.status.pass': '통과',
  'whatif.status.tight': '빠듯함 (±cm 위험)',
  'whatif.status.blocked': '분해 / 리프팅',
  'whatif.tabpfn.title': '이사 견적 & 부피 추정 (RoomGraph 기반 규칙식)',
  'whatif.tabpfn.partner': '규칙 기반 추정',
  'whatif.tabpfn.volume': '부피 / 무게',
  'whatif.tabpfn.truck': '트럭 & 인원',
  'whatif.tabpfn.crew': '({n}명)',
  'whatif.tabpfn.quote': '견적 (P50 / P90)',

  'partner.tab.json': 'RoomGraph JSON',
  'partner.tab.sentry': 'Sentry 트레이스',
  'partner.tab.atlas': 'MongoDB Atlas ({n})',
  'partner.tab.entire': 'Entire CLI 세션',
  'partner.json.schema': '스키마: {v} · 노드: {n} · 엣지: {e}',
  'partner.json.copy': 'JSON 복사',
  'partner.json.copied': '복사됨',
  'partner.json.csv': '매니페스트 CSV',
  'partner.sentry.model': '모델:',
  'partner.sentry.runtime': '런타임:',
  'partner.sentry.latency': '지연 시간: {ms} ms',
  'partner.sentry.tokens': '토큰: {total} ({p}p + {c}c)',
  'partner.sentry.waterfall': '에이전트 스팬 워터폴 (이 앱에서 실측, SENTRY_DSN이 설정된 경우에만 Sentry로 전송)',
  'partner.sentry.notSending':
    'Sentry로 전송되지 않음: 이 컴파일은 Sentry가 추적하지 않았습니다 (서버에 SENTRY_DSN이 설정되지 않음). 아래 스팬은 이 앱이 측정한 값일 뿐입니다.',
  'partner.sentry.delivery': 'Sentry 전송 결과: 성공 {sent}건, 실패 {failed}건',
  'partner.sentry.deliveryError': '마지막 오류: {error}',
  'partner.atlas.placeholder': 'MongoDB Atlas 검색 (가구 라벨, 관측/추론, 제목)...',
  'partner.atlas.saving': 'Atlas에 저장 중...',
  'partner.atlas.upsert': 'RoomGraph를 Atlas에 저장',
  'partner.atlas.sceneId': 'sceneId: {id} · {w}×{d}cm · 객체 {n}개',
  'partner.atlas.load': '씬 불러오기',
  'partner.entire.title':
    'Entire CLI 활성화됨 (`.entire/settings.json` + `entire-session/devrelay-session.json`)',
  'partner.entire.body':
    'Git 훅과 체크포인트는 Entire CLI로 추적합니다 (`entire status` / `entire checkpoint list`). 환각이 생기기 쉬운 포토그래메트리 메시 대신 인식 불확실성 3D/2D 볼륨을 만든 이유를 기록합니다.',
  'partner.entire.cp1.label': '[체크포인트 #1 — 스키마 설계]',
  'partner.entire.cp1.body':
    '단일 이미지 3D 표면 메시는 가려진 모서리를 환각으로 채우고 잘못된 정밀도를 만듭니다. 그래서 모든 객체가 epistemic: observed | inferred | occluded_prior와 명시적 ±cm 오차 범위를 갖도록 roomgraph.v1.2를 설계했습니다.',
  'partner.entire.cp2.label': '[체크포인트 #2 — Gemma 3 비전 프롬프트]',
  'partner.entire.cp2.body':
    'gemma3:4b가 먼저 표준 문틀(210×82cm)로 픽셀-cm 축척을 보정한 뒤 2D bbox, 3D 바운딩 볼륨, 사각지대를 추출합니다.',
  'partner.entire.cp3.label': '[체크포인트 #3 — 3D 인식 볼륨 & 솔버]',
  'partner.entire.cp3.body':
    '인터랙티브 3D 인식 볼륨과 2D 도면 토글을 추가했습니다. 두 객체가 명목상 통과(2cm 간격)하지만 합산 ±12cm 불확실성에서 충돌하면 UNCERTAINTY_OVERFLOW를 표시합니다.',

  'evidence.title': '원본 근거 사진 (Gemma 3 비전 BBox & 인식 상태)',
  'evidence.overlay': '비전 오버레이',
  'evidence.scale': '축척 기준:',
  'evidence.pxcm': 'px/cm:',
  'evidence.tilt': '기울기:',
  'evidence.scaleConf': '축척 신뢰도:',
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, ko };

const STORAGE_KEY = 'reality-compiler-lang';

const readInitialLang = (): Lang => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
};

interface I18nValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable; the choice simply won't persist.
    }
  }, [lang]);

  const toggleLang = useCallback(() => setLang((prev) => (prev === 'en' ? 'ko' : 'en')), []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang];
    const t: I18nValue['t'] = (key, vars) => {
      let text = dict[key];
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(val));
        }
      }
      return text;
    };
    return { lang, toggleLang, t };
  }, [lang, toggleLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}

/** Node label in the active language, falling back to the English label. */
export function nodeLabel(node: { label: string; labelKo?: string }, lang: Lang): string {
  return lang === 'ko' && node.labelKo ? node.labelKo : node.label;
}

export function epistemicBadgeKey(
  epistemic: 'observed' | 'inferred' | 'occluded_prior'
): TranslationKey {
  if (epistemic === 'observed') return 'badge.observed';
  if (epistemic === 'inferred') return 'badge.inferred';
  return 'badge.occluded';
}

const PRESET_KO: Record<string, { name: string; subtitle: string; badge: string }> = {
  'seoul-mapo-studio': {
    name: '도심 원룸 아파트 (340×410cm)',
    subtitle: '퀸 침대, 스탠딩 책상, 옷장 + 침대 뒤 가려진 미니 냉장고',
    badge: '대표 사례 · 불확실성 충돌 데모',
  },
  'brooklyn-loft-living': {
    name: '브루클린 계단식 로프트 (76cm 좁은 문 병목)',
    subtitle: '깊은 L자 소파의 출입구 병목 + 커피 테이블 통로 점검',
    badge: '문 병목 시나리오',
  },
  'gangnam-creator-studio': {
    name: '크리에이터 스튜디오 오피스 (듀얼 데스크 + 12U 랙)',
    subtitle: '대칭 작업대, 12U 서버 랙 열 여유 & 문 여닫이 점검',
    badge: '소규모 사업장 · 사무실 이전',
  },
};

/** Preset name/subtitle/badge in the active language (English source when no translation). */
export function presetCopy(
  preset: { id: string; name: string; subtitle: string; badge: string },
  lang: Lang
): { name: string; subtitle: string; badge: string } {
  if (lang === 'ko' && PRESET_KO[preset.id]) return PRESET_KO[preset.id];
  return { name: preset.name, subtitle: preset.subtitle, badge: preset.badge };
}
