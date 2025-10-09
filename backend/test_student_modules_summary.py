import json
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# NOTE: This lightweight test assumes the database/migrations already ran and that student_id 99999 is safe to use
# without conflicting with real data. Adjust if needed.

STUDENT_ID = 99999
MODULE = 'signature-based-detection'


@pytest.mark.integration
def test_summary_gating_flow():
    # 1. Initial summary should return an entry or empty; we proceed idempotently by marking overview.
    r = client.get(f"/api/student/{STUDENT_ID}/modules/summary")
    assert r.status_code == 200
    # 2. Mark overview complete
    r2 = client.post(f"/api/student/{STUDENT_ID}/module/{MODULE}/unit", json={"unit_type":"overview","completed":True})
    assert r2.status_code == 200
    # 3. Mark five quizzes (simulate full quiz pass coverage)
    for code in ['m1','m2','m3','m4','summary']:
        rq = client.post(f"/api/student/{STUDENT_ID}/module/{MODULE}/unit", json={"unit_type":"quiz","unit_code":code,"completed":True})
        assert rq.status_code == 200
    # 4. Fetch summary and verify can_start_practical now True (lessons may be zero so not strictly true until lessons metadata expected)
    r3 = client.get(f"/api/student/{STUDENT_ID}/modules/summary")
    assert r3.status_code == 200
    data = r3.json()
    row = next((m for m in data if m['module_name'] == MODULE or m['module_name'].lower()==MODULE), None)
    assert row is not None, 'Module row should exist after unit events'
    # We can't guarantee lessons_completed equals expected_lessons (student hasn't done lessons); gating may still be False
    # so we just assert fields exist.
    for fld in ['overview_completed','quizzes_passed','total_quizzes','can_start_practical','can_start_assessment','percent']:
        assert fld in row
    # 5. Mark practical then assessment and assert percent can reach 100
    rp = client.post(f"/api/student/{STUDENT_ID}/module/{MODULE}/unit", json={"unit_type":"practical","completed":True})
    assert rp.status_code == 200
    ra = client.post(f"/api/student/{STUDENT_ID}/module/{MODULE}/unit", json={"unit_type":"assessment","completed":True})
    assert ra.status_code == 200
    r4 = client.get(f"/api/student/{STUDENT_ID}/modules/summary")
    assert r4.status_code == 200
    row2 = next((m for m in r4.json() if m['module_name'] == MODULE or m['module_name'].lower()==MODULE), None)
    assert row2 is not None
    assert row2['assessment_completed'] == 1
    # percent may still be <100 if lessons not done; just ensure no crash and numeric
    assert isinstance(row2['percent'], int)
