from statistics import mean, pstdev

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Vault anomaly service", version="1.0.0")


class ScoreRequest(BaseModel):
    values: list[float] = Field(min_length=1, max_length=5000)
    threshold: float = Field(default=3.0, gt=0)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/score")
def score(req: ScoreRequest) -> dict:
    """Heuristic z-score: flags points far from the mean. Not a trained model."""
    m = mean(req.values)
    s = pstdev(req.values)
    if s == 0:
        scores = [0.0 for _ in req.values]
    else:
        scores = [round(abs(v - m) / s, 3) for v in req.values]
    anomalies = [i for i, z in enumerate(scores) if z >= req.threshold]
    return {
        "model": "zscore-heuristic-v1",
        "mean": round(m, 3),
        "stdev": round(s, 3),
        "scores": scores,
        "anomalies": anomalies,
    }