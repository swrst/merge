using UnityEngine;

namespace DriftwoodCove.Utils
{
    public static class GridUtils
    {
        /// <summary>Converts a (col,row) grid coordinate into a world position, centered on the origin.</summary>
        public static Vector3 CellToWorld(int col, int row, int columns, int rows, float cellSize)
        {
            float originX = -(columns - 1) * cellSize * 0.5f;
            float originY = -(rows - 1) * cellSize * 0.5f;
            return new Vector3(originX + col * cellSize, originY + row * cellSize, 0f);
        }

        public static int ToIndex(int col, int row, int columns) => row * columns + col;
    }
}
