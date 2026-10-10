# COMMAND HISTORY AND SETUP GUIDE

This guide records the exact command sequence needed to set up, run, test, and verify this project on a fresh Windows system. It is based on the actual files in this repository and does not change source code, data, models, or configuration.

Important notes before you start:
- This repository does not include a GitHub repository URL in its project files, so the URL is intentionally left as a placeholder in the clone command.
- The project does not define a strict pinned Python or Node.js version in repo files; the current verified local environment in this workspace is Python 3.12.10, Node.js v24.19.0, npm 11.17.0, and Git 2.53.0.windows.1.
- The backend requirements file is the authoritative dependency list for Python packages in this project.
- There is no backend/test_api.py file in this repository; backend API tests are not included in the project as runnable pytest files.
- The backend automatically creates its SQLite database table when first accessed.

---

## SECTION 1 — SYSTEM REQUIREMENTS

### Required software

This project is designed for Windows and uses:
- Windows 10 or Windows 11
- Python 3.12.10 (verified in this workspace)
- Node.js v24.19.0 (verified in this workspace)
- npm 11.17.0 (verified in this workspace)
- Git 2.53.0.windows.1 (verified in this workspace)

The repository itself does not include a package manager version pin or a `.nvmrc` file. The versions above are the verified versions currently available in this environment.

### Verify the installed tools

Run these commands in a normal Windows terminal (PowerShell or CMD):

```powershell
python --version
pip --version
node --version
npm --version
git --version
```

What each command checks:
- `python --version` checks that Python is installed and available on PATH.
- `pip --version` checks that the Python package installer is available.
- `node --version` checks that Node.js is installed.
- `npm --version` checks that the Node package manager is installed.
- `git --version` checks that Git is installed.

If any of these commands fail, install the missing tool before continuing.

---

## SECTION 2 — CLONE / OPEN PROJECT

### Clone from GitHub

If you are downloading the project for the first time, use:

```powershell
git clone [REPLACE WITH YOUR GITHUB REPOSITORY URL]
cd heart-disease-prediction
```

If the repository URL is not available, use the exact placeholder shown above and replace it when you have the correct link.

### Open an already-downloaded project

```powershell
cd heart-disease-prediction
```

---

## SECTION 3 — CREATE PYTHON VIRTUAL ENVIRONMENT

From the project root:

### PowerShell

```powershell
cd C:\path\to\heart-disease-prediction
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### CMD

```cmd
cd /d C:\path\to\heart-disease-prediction
python -m venv .venv
.venv\Scripts\activate
```

### Confirm the virtual environment is active

After activation, the terminal prompt usually changes and the Python path should point to the local `.venv` folder.

```powershell
python --version
where python
```

Expected result:
- The `python` command should resolve inside `.venv` instead of the global Python installation.
- The path should include `.venv\Scripts\python.exe`.

Upgrade pip inside the virtual environment:

```powershell
python -m pip install --upgrade pip
```

Purpose:
- Ensures the environment uses the current pip version before installing project dependencies.

Do not create another environment unless one already exists and is broken.

---

## SECTION 4 — INSTALL BACKEND / ML DEPENDENCIES

This project uses the dependency list in `backend/requirements.txt`.

### Inspect the requirements file

The file currently contains:

```text
fastapi
uvicorn[standard]
pydantic
python-multipart
numpy
pandas
scikit-learn==1.6.1
joblib
tensorflow
```

This is the actual Python dependency list in the repository and should be installed with:

```powershell
python -m pip install -r backend\requirements.txt
```

Purpose:
- Installs the FastAPI backend, inference stack, model dependencies, and ML libraries required by the project.

### Verify the important packages import successfully

Run:

```powershell
python -c "import fastapi, uvicorn, pandas, numpy, sklearn, joblib, tensorflow; print('Backend and ML imports OK')"
```

Expected result:
- It prints `Backend and ML imports OK`.
- If a package is missing or incompatible, fix the environment before continuing.

### Additional ML packages

No extra package installation is required beyond `backend/requirements.txt` for this project. The repository imports `numpy`, `pandas`, `sklearn`, `joblib`, and `tensorflow` in the actual ML code, and they are already covered by the backend requirements file.

---

## SECTION 5 — VERIFY DATASET

The dataset file is:

```text
data\heart_disease_dataset_13k.csv
```

### Check that the file exists

```powershell
dir data\heart_disease_dataset_13k.csv
```

Expected result:
- File exists in the project data folder.

### Verify schema, row count, columns, and quality of the dataset

Run this from the project root:

```powershell
python -c "import pandas as pd; df = pd.read_csv('data\\heart_disease_dataset_13k.csv'); print('shape=', df.shape); print('columns=', list(df.columns)); print('missing_values=', int(df.isna().sum().sum())); print('duplicate_rows=', int(df.duplicated().sum())); print('target_column=', 'Diagnosis_Class' if 'Diagnosis_Class' in df.columns else 'MISSING'); print('label_column=', 'Diagnosis_Label' if 'Diagnosis_Label' in df.columns else 'MISSING');"
```

Expected verified values from this repository:
- Records: 13,000
- Columns: 25
- Input features: 23
- Target column: `Diagnosis_Class`
- Label column: `Diagnosis_Label`
- Missing values: 0
- Duplicate rows: 0

The dataset is not to be modified.

---

## SECTION 6 — VERIFY ML ARTIFACTS

The saved model and preprocessing artifacts are in:

```text
ml\models\cnn_model.keras
ml\models\class_mapping.json
ml\models\mi_selector.joblib
ml\models\pca_transformer.joblib
ml\models\preprocessor.joblib
ml\models\selected_features.csv
```

These are pre-trained artifacts used for inference and must not be retrained during setup.

### Check the artifact files exist

```powershell
dir ml\models
```

Or, more specifically:

```powershell
python -c "from pathlib import Path; files = ['ml\\models\\cnn_model.keras','ml\\models\\class_mapping.json','ml\\models\\mi_selector.joblib','ml\\models\\pca_transformer.joblib','ml\\models\\preprocessor.joblib','ml\\models\\selected_features.csv']; [print(f'{p}:', Path(p).exists()) for p in files]"
```

Expected result:
- All six files exist.
- The directory contains a trained model and preprocessing artifacts used by the live prediction pipeline.

### Inspect the model and preprocessing artifacts

```powershell
python -c "import joblib, json, os; from pathlib import Path; p = Path('ml/models'); print('cnn_model.keras exists:', (p/'cnn_model.keras').exists()); print('class_mapping.json exists:', (p/'class_mapping.json').exists()); print('preprocessor.joblib exists:', (p/'preprocessor.joblib').exists()); print('pca_transformer.joblib exists:', (p/'pca_transformer.joblib').exists()); print('mi_selector.joblib exists:', (p/'mi_selector.joblib').exists()); print('selected_features.csv exists:', (p/'selected_features.csv').exists()); print('class_mapping=', json.loads((p/'class_mapping.json').read_text(encoding='utf-8')));"
```

Purpose:
- Confirms saved model artifacts are present and readable before starting the backend.

---

## SECTION 7 — ML PIPELINE

This project uses the following inference flow:

```text
23 raw clinical features
        ↓
Preprocessing
        ↓
27 processed features
        ↓
Mutual Information
        ↓
20 selected features
        ↓
PCA
        ↓
18 components
        ↓
reshape to (18,1)
        ↓
1D CNN
        ↓
7-class Softmax
        ↓
Prediction + probabilities + confidence
```

This matches the project logic in `ml/preprocessing.py` and `ml/predict.py`.

### Seven disease classes

```text
0 = Normal
1 = Arrhythmia
2 = Cardiovascular Disease
3 = Coronary Artery Disease
4 = Congenital Heart Disease
5 = Cardiomyopathy
6 = Heart Infections
```

The class labels are defined by the project file `ml/models/class_mapping.json`.

---

## SECTION 8 — VERIFY BACKEND

The FastAPI backend entry point is `backend/main.py`.

### Start the backend

Use:

```powershell
cd C:\path\to\heart-disease-prediction
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

CMD equivalent:

```cmd
cd /d C:\path\to\heart-disease-prediction
.venv\Scripts\activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Purpose:
- Starts the FastAPI backend in reload mode for local development.

### Expected backend settings

- Host: `0.0.0.0`
- Port: `8000`
- API root: `http://localhost:8000/`
- Health endpoint: `http://localhost:8000/health`
- Prediction endpoint: `POST http://localhost:8000/predict`
- CSV prediction endpoint: `POST http://localhost:8000/predict-csv`
- Model analysis endpoint: `GET http://localhost:8000/model-analysis`
- History endpoint: `GET http://localhost:8000/history`

The routes are implemented in `backend/main.py`.

---

## SECTION 9 — BACKEND API TESTING

### Health checks

In a separate terminal, or in the same terminal after the backend is running:

```powershell
curl http://localhost:8000/
curl http://localhost:8000/health
```

or with PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/
Invoke-RestMethod http://localhost:8000/health
```

Expected result:
- `/` returns service status
- `/health` returns healthy status

### Prediction endpoint test

Example request body for `POST /predict`:

```json
{
  "Age": 52,
  "BMI": 24.5,
  "Resting_BP": 120,
  "Serum_Cholesterol": 180,
  "Fasting_Blood_Sugar": 0,
  "Max_Heart_Rate": 160,
  "ST_Depression_Oldpeak": 1.2,
  "Ejection_Fraction": 55,
  "Troponin_Level": 0.03,
  "BNP_Level": 120,
  "CRP_Level": 1.5,
  "WBC_Count": 6.2,
  "HRV_SDNN": 45,
  "Resting_Respiratory_Rate": 16,
  "SpO2": 98,
  "Triglycerides": 130,
  "LDL_Cholesterol": 90,
  "HDL_Cholesterol": 40,
  "Cigarettes_Per_Day": 0,
  "Alcohol_ml_Per_Day": 0,
  "Gender": 1,
  "Family_History": 2,
  "Diabetes_Status": 1
}
```

Test with:

```powershell
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d "{\"Age\":52,\"BMI\":24.5,\"Resting_BP\":120,\"Serum_Cholesterol\":180,\"Fasting_Blood_Sugar\":0,\"Max_Heart_Rate\":160,\"ST_Depression_Oldpeak\":1.2,\"Ejection_Fraction\":55,\"Troponin_Level\":0.03,\"BNP_Level\":120,\"CRP_Level\":1.5,\"WBC_Count\":6.2,\"HRV_SDNN\":45,\"Resting_Respiratory_Rate\":16,\"SpO2\":98,\"Triglycerides\":130,\"LDL_Cholesterol\":90,\"HDL_Cholesterol\":40,\"Cigarettes_Per_Day\":0,\"Alcohol_ml_Per_Day\":0,\"Gender\":1,\"Family_History\":2,\"Diabetes_Status\":1}"
```

Expected result:
- JSON response from the backend
- `predicted_class` as an integer 0-6
- `predicted_label` as one of the class labels
- `confidence` as a probability between 0 and 1
- `probabilities` containing all seven class probabilities

### Test command for backend API file

No `backend/test_api.py` file exists in this repository. There is no Python pytest command for backend tests included in the project.

If you later add tests, the general command would be:

```powershell
python -m pytest backend/test_api.py -q
```

But in this repository, that file does not exist and there is no project-defined backend test script to run.

---

## SECTION 10 — FRONTEND ENVIRONMENT

The frontend `.env.local` file is present and contains:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This is the actual backend URL used by the frontend.

Use this in the app configuration and do not change it unless the backend port changes.

---

## SECTION 11 — INSTALL FRONTEND DEPENDENCIES

From the project root:

```powershell
cd frontend
npm install
```

Purpose:
- Installs the project dependencies declared in `frontend/package.json`.

This repository includes `package-lock.json`, so `npm install` is the standard project workflow. `npm ci` is also valid if you want to strictly respect the lockfile, but the project scripts and lockfile currently support `npm install` as the straightforward setup path.

---

## SECTION 12 — RUN FRONTEND

The frontend script is defined in `frontend/package.json` and is:

```json
"dev": "next dev --port 3010"
```

Run:

```powershell
cd C:\path\to\heart-disease-prediction\frontend
npm run dev
```

Expected result:
- Next.js development server starts on:
  `http://localhost:3010`

This project is configured to use port `3010` for the frontend, not `3000`.

---

## SECTION 13 — FRONTEND VERIFICATION

The project defines these frontend scripts in `frontend/package.json`:

```json
"build": "next build",
"lint": "eslint"
```

### Lint command

```powershell
cd frontend
npm run lint
```

Expected result:
- No errors in ESLint output.
- In this repository, the lint run currently reports one warning, not a blocking error:
  `productionPipeline` is assigned a value but never used in `frontend/app/models/page.tsx`.

This is a warning; the script still runs.

### Build command

```powershell
cd frontend
npm run build
```

Expected result on a clean build:
- Next.js completes a production build without fatal errors.

Current status in this workspace:
- The script exists and is the correct project command.
- A clean success confirmation was not reached in this session because the build did not finish before interruption in the terminal session. Do not claim a successful production build unless the command finishes without errors on your machine.

---

## SECTION 14 — FULL APPLICATION STARTUP

Use two terminals.

### TERMINAL 1 — Backend

```powershell
cd C:\path\to\heart-disease-prediction
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### TERMINAL 2 — Frontend

```powershell
cd C:\path\to\heart-disease-prediction\frontend
npm run dev
```

Expected result:
- Backend is available at `http://localhost:8000`
- Frontend is available at `http://localhost:3010`

---

## SECTION 15 — MANUAL PREDICTION TEST

Follow this sequence in the frontend:

1. Open the app in a browser at `http://localhost:3010`
2. Open the prediction page
3. Enter all required patient fields from the 23-feature model input schema
4. Submit the form
5. Verify the prediction class label appears
6. Verify the predicted probability/confidence value appears
7. Verify the result page or result panel shows the same prediction and confidence

### Example sample/test values (example only)

Use only as a sample to confirm the form works, not as a medical dataset:

```text
Age=52
BMI=24.5
Resting_BP=120
Serum_Cholesterol=180
Fasting_Blood_Sugar=0
Max_Heart_Rate=160
ST_Depression_Oldpeak=1.2
Ejection_Fraction=55
Troponin_Level=0.03
BNP_Level=120
CRP_Level=1.5
WBC_Count=6.2
HRV_SDNN=45
Resting_Respiratory_Rate=16
SpO2=98
Triglycerides=130
LDL_Cholesterol=90
HDL_Cholesterol=40
Cigarettes_Per_Day=0
Alcohol_ml_Per_Day=0
Gender=1
Family_History=2
Diabetes_Status=1
```

Then verify:
- The UI accepts the values
- The model returns a prediction label
- The confidence value is shown as a probability or percentage
- The result page is consistent with the raw response

---

## SECTION 16 — CSV BATCH PREDICTION TEST

This project supports CSV upload through the backend endpoint `/predict-csv`.

### CSV preparation

Create a CSV file with the required 23 feature columns exactly matching the model input schema:

```text
Age,Gender,BMI,Resting_BP,Serum_Cholesterol,Fasting_Blood_Sugar,Max_Heart_Rate,ST_Depression_Oldpeak,Ejection_Fraction,Troponin_Level,BNP_Level,CRP_Level,WBC_Count,HRV_SDNN,Resting_Respiratory_Rate,SpO2,Triglycerides,LDL_Cholesterol,HDL_Cholesterol,Cigarettes_Per_Day,Family_History,Diabetes_Status,Alcohol_ml_Per_Day
```

Do not alter the original dataset file in `data/heart_disease_dataset_13k.csv`.

### CSV upload steps

1. Open the CSV prediction workflow in the frontend
2. Upload a CSV that has those 23 feature columns
3. Validate the columns before submission
4. Submit the file for prediction
5. Verify the backend response contains one prediction per row
6. Confirm the predicted class, label, and confidence for each row

### Example verification

```powershell
curl -X POST http://localhost:8000/predict-csv -F "file=@sample_patients.csv"
```

Expected result:
- The backend returns a JSON response with total records and per-row prediction results.
- Each result contains predicted class, label, and confidence.
- The `results` array should match the number of rows submitted.

---

## SECTION 17 — MODEL ANALYSIS

The project provides a model analysis page and underlying evaluation artifacts.

### Analysis assets already present

The repository includes these files in `ml/outputs/graphs`:

```text
mutual_information_scores.png
selected_mi_features.png
pca_scree_plot.png
pca_cumulative_variance.png
training_accuracy.png
training_loss.png
confusion_matrix.png
per_class_performance.png
correlation_matrix.png
```

The backend also exposes the model-analysis API at:

```powershell
curl http://localhost:8000/model-analysis
```

Open the frontend model analysis page in the browser:

```text
http://localhost:3010/models
```

What to verify:
- Model analysis loads successfully from `/model-analysis`
- The page shows performance metrics and class labels
- The analysis page reflects the final frozen model and model analysis output assets

Do not generate fake metrics or retrain the model.

---

## SECTION 18 — DATABASE / HISTORY

The SQLite database file is:

```text
backend\prediction_history.sqlite3
```

Prediction history is stored automatically by the backend logic in `backend/history.py`.

The backend creates the table if it does not exist, then writes prediction records when the app processes a prediction.

### Database behavior

- The app stores prediction results for each successful prediction.
- The history is exposed through the endpoint:
  `GET http://localhost:8000/history`
- The frontend dashboard displays saved prediction activity from that database.

No separate database initialization command is required; the existing application handles database access automatically.

Do not delete or rename the existing SQLite file.

---

## SECTION 19 — COMPLETE COMMAND LIST

## QUICK START — ALL COMMANDS IN ORDER

1. Check Python
2. Check Node.js and npm
3. Clone or open the project
4. Create virtual environment
5. Activate virtual environment
6. Upgrade pip
7. Install backend dependencies
8. Verify dataset and model artifacts
9. Start backend
10. Open second terminal
11. Install frontend dependencies
12. Start frontend
13. Run backend health check
14. Run prediction test
15. Run CSV prediction test
16. Run lint
17. Run build
18. Verify model analysis page
19. Verify history database
20. Confirm the app works end-to-end

### Quick command flow

```powershell
python --version
pip --version
node --version
npm --version
git --version

cd C:\path\to\heart-disease-prediction
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
python -c "import pandas as pd; df = pd.read_csv('data\\heart_disease_dataset_13k.csv'); print(df.shape); print(df.isna().sum().sum()); print(df.duplicated().sum())"
python -c "from pathlib import Path; import json; p = Path('ml/models'); print((p/'cnn_model.keras').exists(), (p/'class_mapping.json').exists(), (p/'preprocessor.joblib').exists())"

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

cd frontend
npm install
npm run dev
```

---

## SECTION 20 — TROUBLESHOOTING

### Python not recognized

```powershell
python --version
```

Solution:
- Reinstall Python and enable the option to add Python to PATH.
- Restart the terminal after installation.

### Node not recognized

```powershell
node --version
npm --version
```

Solution:
- Install Node.js LTS and reopen the terminal.
- Ensure Node.js is added to PATH.

### pip installation error

```powershell
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

Solution:
- Ensure the virtual environment is active.
- Upgrade pip first.
- Check that the Python environment is the one you expect.

### Virtual environment activation error

PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

CMD:

```cmd
.venv\Scripts\activate
```

Solution:
- PowerShell may block activation because of execution policies.
- Use `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` if allowed.

### PowerShell execution policy error

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Solution:
- Allows local scripts to run while still prompting for downloaded scripts.

### Port 8000 already in use

```powershell
netstat -ano | findstr :8000
```

Solution:
- Stop the process using the port or change the port:

```powershell
uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

### Port 3000 already in use

This frontend uses port 3010 by default, so it normally avoids the standard port conflict.

If needed, check and stop the conflicting process:

```powershell
netstat -ano | findstr :3010
```

### Missing Python package

```powershell
python -m pip install -r backend\requirements.txt
```

Solution:
- Reinstall the backend requirements file.
- Make sure the virtual environment is active.

### Frontend npm installation error

```powershell
cd frontend
npm install
```

Solution:
- Delete `node_modules` and `package-lock.json` only if the lockfile is clearly corrupt, then rerun `npm install`.
- Ensure Node.js and npm are installed and on PATH.

### API connection refused

Solution:
- Confirm the backend is running:

```powershell
curl http://localhost:8000/health
```

- If it is not running, start the backend first.
- Confirm the frontend `.env.local` file contains `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### Model file not found

```powershell
dir ml\models
```

Solution:
- Ensure the project root is correct.
- Check that `ml/models/cnn_model.keras` exists.
- Do not retrain or rename the model files.

### Dataset file not found

```powershell
dir data\heart_disease_dataset_13k.csv
```

Solution:
- Ensure the project contains the original dataset file in `data/`.
- Do not modify or delete the dataset.

### CSV column mismatch

Solution:
- Use the exact required 23 feature columns.
- Confirm the CSV includes the expected model feature names and no extra unknown columns.
- Validate the CSV before uploading.

### FastAPI startup error

```powershell
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Solution:
- Ensure the virtual environment is active.
- Reinstall backend requirements.
- Check that the environment has TensorFlow and scikit-learn available.
- Confirm the project path is correct.

### Next.js build error

```powershell
cd frontend
npm run build
```

Solution:
- Ensure `npm install` has completed successfully.
- Check the actual error in the build output.
- Do not change project source code simply to force a build to pass unless you are intentionally editing the app.

---

## SECTION 21 — FINAL VERIFICATION CHECKLIST

```text
[ ] Python installed
[ ] Node.js installed
[ ] Virtual environment created
[ ] Backend dependencies installed
[ ] Dataset available
[ ] ML artifacts available
[ ] FastAPI starts successfully
[ ] Health endpoint works
[ ] Prediction endpoint works
[ ] CSV prediction works
[ ] SQLite history works
[ ] Frontend dependencies installed
[ ] Next.js starts successfully
[ ] Frontend connects to backend
[ ] Manual prediction works
[ ] CSV prediction works
[ ] Model Analysis page works
[ ] npm lint passes
[ ] npm build passes
[ ] Backend tests pass
```

Note:
- In this repository, no backend API test file exists, so there is no project-provided backend pytest test command to run.
- The frontend lint command exists and currently emits one warning, not an error.
- The build command exists but was not confirmed as a clean success in this session.

---

## SUMMARY

- File created: `COMMAND_HISTORY_AND_SETUP.md`
- Number of command sections: 21
- Backend start command: `uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend start command: `cd frontend` then `npm run dev`
- Test command: No backend test file exists in this project; there is no repository-provided backend pytest command for this repo.
- Build command: `cd frontend` then `npm run build`

This file contains the verified setup and execution commands for this project, arranged in the exact order they should be executed on a fresh Windows machine.
