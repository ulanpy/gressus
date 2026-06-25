# Async empty-exo baseline calibration status, published on a latched
# (transient_local) topic so a late subscriber always gets the latest state.

string state          # idle | running | done | failed | cancelled
float32 elapsed_s
float32 remaining_s
float32 progress      # 0..1
string message
uint32 run_id         # increments per calibration run; lets clients detect a new run

# Populated only when state == "done":
#   {"coeffs": [[joint, 0, [a,b,c,d,e]], ...], "meta": {"cps":..,"r2":{..},"resid_std":{..},"ts":".."}}
string coeffs_json
