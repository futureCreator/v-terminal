#pragma once
#include "TerminalBuffer.h"
#include "Types.h"
#include <d2d1_1.h>
#include <dwrite_3.h>
#include <dxgi1_3.h>
#include <d3d11.h>
#include <wrl/client.h>
#include <string>
#include <unordered_map>

namespace VTerminal {

struct RendererConfig {
    std::wstring fontFamily = L"JetBrains Mono";
    float fontSize = 14.0f;
    float lineHeight = 1.2f;
    bool cursorBlink = true;
    CursorStyle cursorStyle = CursorStyle::Block;
};

class TerminalRenderer {
public:
    TerminalRenderer();
    ~TerminalRenderer();

    bool initialize(IUnknown* panelNative, float width, float height);
    void setConfig(const RendererConfig& config);
    void setTheme(const TerminalTheme& theme);
    void render(const TerminalBuffer& buffer, int cursorRow, int cursorCol);
    void resize(float width, float height);

    float cellWidth() const { return m_cellWidth; }
    float cellHeight() const { return m_cellHeight; }
    int gridCols() const;
    int gridRows() const;

private:
    bool createDeviceResources();
    bool createSwapChain(IUnknown* panelNative, float width, float height);
    void createTextFormat();
    void measureCellSize();
    void renderRow(const TerminalBuffer& buffer, int row);
    void renderCursor(int row, int col);
    D2D1_COLOR_F colorFromIndex(uint32_t index) const;

    Microsoft::WRL::ComPtr<ID3D11Device> m_d3dDevice;
    Microsoft::WRL::ComPtr<ID2D1Factory1> m_d2dFactory;
    Microsoft::WRL::ComPtr<ID2D1Device> m_d2dDevice;
    Microsoft::WRL::ComPtr<ID2D1DeviceContext> m_d2dContext;
    Microsoft::WRL::ComPtr<IDXGISwapChain1> m_swapChain;
    Microsoft::WRL::ComPtr<ID2D1Bitmap1> m_targetBitmap;
    Microsoft::WRL::ComPtr<IDWriteFactory3> m_dwriteFactory;
    Microsoft::WRL::ComPtr<IDWriteTextFormat> m_textFormat;

    std::unordered_map<uint32_t, Microsoft::WRL::ComPtr<ID2D1SolidColorBrush>> m_brushCache;

    RendererConfig m_config;
    TerminalTheme m_theme;
    float m_cellWidth = 0;
    float m_cellHeight = 0;
    float m_width = 0;
    float m_height = 0;

    ID2D1SolidColorBrush* getBrush(uint32_t colorIndex);
};

} // namespace VTerminal
