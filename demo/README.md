# Grant Scraper Demo

Python 서버 데모 프로젝트입니다. Grants.gov API와 웹 스크래핑을 통해 미국 내 grant 정보를 수집하고, FastAPI + Gradio로 데모하는 시스템입니다.

## 🚀 주요 기능

1. **Grants.gov API 연동** - 연방 정부 grant 기회 수집
2. **웹 스크래핑** - BeautifulSoup, Playwright를 활용한 주정부 grant 정보 수집
3. **FastAPI 백엔드** - RESTful API 서버
4. **Gradio 프론트엔드** - 웹 기반 데모 인터페이스
5. **SQLite 데이터베이스** - 로컬 데이터 저장

## 📁 프로젝트 구조

```
grantwell-demo/
├── src/
│   ├── api/
│   │   └── grants_client.py        # Grants.gov API 클라이언트
│   ├── scraper/
│   │   └── state_scrapers.py       # 주정부 웹사이트 스크래퍼
│   ├── database/
│   │   └── models.py               # SQLAlchemy 모델
│   └── web/
│       └── fastapi_server.py       # FastAPI 서버
├── data/                           # SQLite DB 저장 폴더
├── logs/                           # 로그 파일
├── gradio_demo.py                  # Gradio 데모 인터페이스
├── requirements.txt                # Python 의존성
└── README.md
```

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
pip install -r requirements.txt
```

### 2. Playwright 브라우저 설치 (선택사항)

```bash
playwright install chromium
```

### 3. FastAPI 서버 실행

```bash
python src/web/fastapi_server.py
```

서버가 http://localhost:8000 에서 실행됩니다.

### 4. Gradio 데모 실행

새 터미널에서:

```bash
python gradio_demo.py
```

데모가 http://localhost:7860 에서 실행됩니다.

## 🌐 API 엔드포인트

FastAPI 서버 실행 후 http://localhost:8000/docs 에서 자세한 API 문서를 확인할 수 있습니다.

### 주요 엔드포인트

- `GET /grants/` - Grant 목록 조회 (필터링 지원)
- `POST /scrape/grants-gov/` - Grants.gov 데이터 수집
- `POST /scrape/states/` - 주정부 웹사이트 데이터 수집
- `GET /stats/` - 데이터베이스 통계
- `GET /scraping-logs/` - 스크래핑 로그 조회
- `DELETE /grants/clear/` - 데이터베이스 초기화

## 📊 사용 방법

### 1. 데이터 수집

#### Grants.gov API 사용:
```bash
curl -X POST "http://localhost:8000/scrape/grants-gov/" \
     -H "Content-Type: application/json" \
     -d '{"keyword": "education", "limit": 25}'
```

#### 주정부 웹사이트 스크래핑:
```bash
curl -X POST "http://localhost:8000/scrape/states/"
```

### 2. 데이터 조회

```bash
# 모든 grant 조회
curl "http://localhost:8000/grants/"

# 소스별 필터링
curl "http://localhost:8000/grants/?source=grants.gov"

# 주별 필터링
curl "http://localhost:8000/grants/?state=california"
```

### 3. 통계 확인

```bash
curl "http://localhost:8000/stats/"
```

## 🎯 지원하는 데이터 소스

### Federal (연방)
- **Grants.gov** - 공식 연방 정부 grant 포털

### State (주정부)
- **California** - grants.ca.gov
- **Texas** - comptroller.texas.gov
- **Florida** - myflorida.com
- **New York** - grantsgateway.ny.gov  
- **Illinois** - illinois.gov

## 🔧 기술 스택

- **Backend**: FastAPI, SQLAlchemy, SQLite
- **Scraping**: BeautifulSoup4, Playwright, Requests
- **Frontend**: Gradio
- **Database**: SQLite
- **API**: Grants.gov REST API

## ⚡ 데모 특징

- **실시간 데이터 수집**: 백그라운드에서 비동기 스크래핑
- **다중 소스 지원**: API와 웹 스크래핑 조합
- **필터링 및 검색**: 소스, 주, 키워드별 검색
- **통계 대시보드**: 수집된 데이터 현황 확인
- **사용자 친화적 인터페이스**: Gradio 웹 UI

## 🚨 주의사항

- 웹 스크래핑은 교육 목적으로만 사용하세요
- 대량 스크래핑 시 사이트 정책을 준수하세요  
- 일부 주정부 사이트는 JavaScript 의존적이어서 Playwright가 필요할 수 있습니다
- 데이터는 로컬 SQLite DB에만 저장됩니다

## 📝 라이선스

이 프로젝트는 교육 및 데모 목적으로 제작되었습니다.