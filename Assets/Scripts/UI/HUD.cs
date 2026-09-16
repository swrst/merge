using System.Text;
using DriftwoodCove.Systems;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace DriftwoodCove.UI
{
    /// <summary>
    /// Builds a minimal heads-up display entirely from code (Canvas, EventSystem,
    /// Text elements) so opening the project needs zero manual scene wiring for
    /// v1. Swapping this for hand-designed UI/TextMeshPro is a natural v2 step.
    /// </summary>
    public class HUD : MonoBehaviour
    {
        private Text _energyText;
        private Text _coinsText;
        private Text _ordersText;

        private EnergySystem _energy;
        private CurrencySystem _currency;
        private OrderSystem _orders;

        public void Init(EnergySystem energy, CurrencySystem currency, OrderSystem orders)
        {
            _energy = energy;
            _currency = currency;
            _orders = orders;

            BuildCanvas();

            _energy.Changed += Refresh;
            _currency.Changed += Refresh;
            _orders.Changed += Refresh;
            Refresh();
        }

        private void BuildCanvas()
        {
            if (FindObjectOfType<EventSystem>() == null)
            {
                var esGo = new GameObject("EventSystem");
                esGo.AddComponent<EventSystem>();
                esGo.AddComponent<StandaloneInputModule>();
            }

            var canvasGo = new GameObject("HUD Canvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            canvasGo.AddComponent<GraphicRaycaster>();

            _energyText = CreateText(canvasGo.transform, "EnergyText", TextAnchor.UpperLeft,
                new Vector2(0f, 1f), new Vector2(20f, -20f));
            _coinsText = CreateText(canvasGo.transform, "CoinsText", TextAnchor.UpperRight,
                new Vector2(1f, 1f), new Vector2(-20f, -20f));
            _ordersText = CreateText(canvasGo.transform, "OrdersText", TextAnchor.LowerLeft,
                new Vector2(0f, 0f), new Vector2(20f, 20f));
        }

        private static Text CreateText(Transform parent, string name, TextAnchor anchor, Vector2 anchorPoint, Vector2 offset)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = 42;
            text.color = Color.white;
            text.alignment = anchor;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = anchorPoint;
            rt.anchorMax = anchorPoint;
            rt.pivot = anchorPoint;
            rt.anchoredPosition = offset;
            rt.sizeDelta = new Vector2(600, 300);
            return text;
        }

        private void Refresh()
        {
            _energyText.text = $"Energy: {_energy.Current}/{_energy.Max}";
            _coinsText.text = $"Coins: {_currency.Coins}";

            var sb = new StringBuilder("Orders:\n");
            foreach (var order in _orders.ActiveOrders)
                sb.AppendLine($"- {order.Item?.DisplayName} (+{order.CoinReward}c)");
            _ordersText.text = sb.ToString();
        }
    }
}
