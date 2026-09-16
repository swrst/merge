using DriftwoodCove.Systems;
using DriftwoodCove.UI;
using UnityEngine;

namespace DriftwoodCove.Core
{
    /// <summary>
    /// Entry point for the v1 vertical slice. Attach this to a single empty
    /// GameObject in an otherwise empty scene and press Play -- everything else
    /// (camera, board, HUD) is built from code. See Assets/../SETUP.md at the
    /// project root for the exact Unity Editor steps.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        [Header("Energy")]
        public int MaxEnergy = 20;
        public float SecondsPerEnergyRegen = 45f;

        private EnergySystem _energy;
        private CurrencySystem _currency;
        private OrderSystem _orders;
        private GridManager _grid;
        private NeighborSystem _neighbors;
        private HUD _hud;

        private float _autoSaveTimer;
        private const float AutoSaveInterval = 10f;

        private void Awake()
        {
            SetupCamera();

            var save = SaveSystem.Load();

            _energy = new EnergySystem(MaxEnergy, SecondsPerEnergyRegen, save?.energy ?? -1);
            _currency = new CurrencySystem(save?.coins ?? 25);

            _orders = new OrderSystem();
            if (save != null && save.orders != null && save.orders.Count > 0)
                _orders.LoadState(save.orders);
            else
                _orders.GenerateInitialOrders();

            var neighborsGo = new GameObject("NeighborSystem");
            neighborsGo.transform.SetParent(transform, false);
            _neighbors = neighborsGo.AddComponent<NeighborSystem>();

            var gridGo = new GameObject("GridManager");
            gridGo.transform.SetParent(transform, false);
            _grid = gridGo.AddComponent<GridManager>();
            _grid.Init(_energy, _currency, _orders, _neighbors);

            if (save != null)
                _grid.RestoreState(save.tiles);

            var hudGo = new GameObject("HUD");
            hudGo.transform.SetParent(transform, false);
            _hud = hudGo.AddComponent<HUD>();
            _hud.Init(_energy, _currency, _orders);
        }

        private void SetupCamera()
        {
            var cam = Camera.main;
            if (cam == null)
            {
                var camGo = new GameObject("Main Camera");
                camGo.tag = "MainCamera";
                cam = camGo.AddComponent<Camera>();
            }
            cam.orthographic = true;
            cam.orthographicSize = 5f;
            cam.backgroundColor = new Color(0.53f, 0.78f, 0.85f); // soft cove-sky blue
            cam.transform.position = new Vector3(0f, 0f, -10f);
        }

        private void Update()
        {
            _energy.Tick(Time.deltaTime);

            _autoSaveTimer += Time.deltaTime;
            if (_autoSaveTimer >= AutoSaveInterval)
            {
                _autoSaveTimer = 0f;
                SaveNow();
            }
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) SaveNow();
        }

        private void OnApplicationQuit()
        {
            SaveNow();
        }

        private void SaveNow()
        {
            var data = new SaveSystem.SaveData
            {
                energy = _energy.Current,
                coins = _currency.Coins,
                tiles = _grid.CaptureState(),
            };
            foreach (var order in _orders.ActiveOrders)
                data.orders.Add(new SaveSystem.OrderSave { chainId = order.ChainId, tier = order.Tier, coinReward = order.CoinReward });
            SaveSystem.Save(data);
        }
    }
}
