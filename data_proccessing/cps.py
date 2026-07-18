from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

CSV_PATH = Path("session_p5_20260625_combined.csv")

df = pd.read_csv(CSV_PATH)

if "cps" not in df.columns:
    raise ValueError("Column 'cps' not found.")

cps = df["cps"]

print("=== CPS Summary ===")
print(cps.describe())

print("\nMissing values:", cps.isna().sum())
print("Unique values:", cps.nunique())

print("\nValue counts:")
print(cps.value_counts(dropna=False).sort_index())

print("\nFirst 20 values:")
print(cps.head(20).to_list())

# Plot CPS over samples
plt.figure(figsize=(12, 4))
plt.plot(cps)
plt.title("CPS over Samples")
plt.xlabel("Sample")
plt.ylabel("CPS")
plt.grid(True)
plt.tight_layout()
plt.show()

# Histogram
plt.figure(figsize=(6, 4))
plt.hist(cps.dropna(), bins=30)
plt.title("CPS Distribution")
plt.xlabel("CPS")
plt.ylabel("Count")
plt.grid(True)
plt.tight_layout()
plt.show()