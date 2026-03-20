#include "TerminalRenderer.h"
#include <d2d1_1.h>
#include <d3d11.h>
#include <dxgi1_2.h>

#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "dwrite.lib")

using Microsoft::WRL::ComPtr;

namespace VTerminal {

// Default 16-color ANSI palette
static const D2D1_COLOR_F kDefaultPalette[16] = {
    {0.0f, 0.0f, 0.0f, 1.0f},       // 0: Black
    {0.8f, 0.0f, 0.0f, 1.0f},       // 1: Red
    {0.0f, 0.8f, 0.0f, 1.0f},       // 2: Green
    {0.8f, 0.8f, 0.0f, 1.0f},       // 3: Yellow
    {0.0f, 0.0f, 0.8f, 1.0f},       // 4: Blue
    {0.8f, 0.0f, 0.8f, 1.0f},       // 5: Magenta
    {0.0f, 0.8f, 0.8f, 1.0f},       // 6: Cyan
    {0.75f, 0.75f, 0.75f, 1.0f},    // 7: White
    {0.5f, 0.5f, 0.5f, 1.0f},       // 8: Bright Black
    {1.0f, 0.0f, 0.0f, 1.0f},       // 9: Bright Red
    {0.0f, 1.0f, 0.0f, 1.0f},       // 10: Bright Green
    {1.0f, 1.0f, 0.0f, 1.0f},       // 11: Bright Yellow
    {0.0f, 0.0f, 1.0f, 1.0f},       // 12: Bright Blue
    {1.0f, 0.0f, 1.0f, 1.0f},       // 13: Bright Magenta
    {0.0f, 1.0f, 1.0f, 1.0f},       // 14: Bright Cyan
    {1.0f, 1.0f, 1.0f, 1.0f},       // 15: Bright White
};

TerminalRenderer::TerminalRenderer() = default;
TerminalRenderer::~TerminalRenderer() = default;

bool TerminalRenderer::initialize(IUnknown* panelNative, float width, float height) {
    m_width = width;
    m_height = height;

    if (!createDeviceResources()) return false;
    if (!createSwapChain(panelNative, width, height)) return false;
    createTextFormat();
    measureCellSize();
    return true;
}

bool TerminalRenderer::createDeviceResources() {
    // Create D3D11 device
    D3D_FEATURE_LEVEL featureLevels[] = { D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0 };
    UINT creationFlags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
#ifdef _DEBUG
    creationFlags |= D3D11_CREATE_DEVICE_DEBUG;
#endif

    ComPtr<ID3D11Device> d3dDevice;
    HRESULT hr = D3D11CreateDevice(
        nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
        creationFlags, featureLevels, ARRAYSIZE(featureLevels),
        D3D11_SDK_VERSION, &d3dDevice, nullptr, nullptr);
    if (FAILED(hr)) return false;
    m_d3dDevice = d3dDevice;

    // Create D2D factory
    hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, m_d2dFactory.GetAddressOf());
    if (FAILED(hr)) return false;

    // Get DXGI device
    ComPtr<IDXGIDevice> dxgiDevice;
    hr = m_d3dDevice.As(&dxgiDevice);
    if (FAILED(hr)) return false;

    // Create D2D device and context
    hr = m_d2dFactory->CreateDevice(dxgiDevice.Get(), &m_d2dDevice);
    if (FAILED(hr)) return false;

    hr = m_d2dDevice->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE, &m_d2dContext);
    if (FAILED(hr)) return false;

    // Create DWrite factory
    hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,
        __uuidof(IDWriteFactory3),
        reinterpret_cast<IUnknown**>(m_dwriteFactory.GetAddressOf()));
    if (FAILED(hr)) return false;

    return true;
}

bool TerminalRenderer::createSwapChain(IUnknown* panelNative, float width, float height) {
    ComPtr<IDXGIDevice> dxgiDevice;
    HRESULT hr = m_d3dDevice.As(&dxgiDevice);
    if (FAILED(hr)) return false;

    ComPtr<IDXGIAdapter> dxgiAdapter;
    hr = dxgiDevice->GetAdapter(&dxgiAdapter);
    if (FAILED(hr)) return false;

    ComPtr<IDXGIFactory2> dxgiFactory;
    hr = dxgiAdapter->GetParent(IID_PPV_ARGS(&dxgiFactory));
    if (FAILED(hr)) return false;

    DXGI_SWAP_CHAIN_DESC1 desc = {};
    desc.Width = static_cast<UINT>(width);
    desc.Height = static_cast<UINT>(height);
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    desc.BufferCount = 2;
    desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
    desc.AlphaMode = DXGI_ALPHA_MODE_PREMULTIPLIED;

    hr = dxgiFactory->CreateSwapChainForComposition(
        m_d3dDevice.Get(), &desc, nullptr, &m_swapChain);
    if (FAILED(hr)) return false;

    // Get back buffer and create D2D bitmap target
    ComPtr<IDXGISurface> backBuffer;
    hr = m_swapChain->GetBuffer(0, IID_PPV_ARGS(&backBuffer));
    if (FAILED(hr)) return false;

    D2D1_BITMAP_PROPERTIES1 bitmapProps = D2D1::BitmapProperties1(
        D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
        D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED));

    hr = m_d2dContext->CreateBitmapFromDxgiSurface(backBuffer.Get(), &bitmapProps, &m_targetBitmap);
    if (FAILED(hr)) return false;

    m_d2dContext->SetTarget(m_targetBitmap.Get());
    return true;
}

void TerminalRenderer::createTextFormat() {
    if (!m_dwriteFactory) return;
    m_dwriteFactory->CreateTextFormat(
        m_config.fontFamily.c_str(),
        nullptr,
        DWRITE_FONT_WEIGHT_REGULAR,
        DWRITE_FONT_STYLE_NORMAL,
        DWRITE_FONT_STRETCH_NORMAL,
        m_config.fontSize,
        L"en-us",
        reinterpret_cast<IDWriteTextFormat**>(m_textFormat.GetAddressOf()));
}

void TerminalRenderer::measureCellSize() {
    if (!m_dwriteFactory || !m_textFormat) return;

    ComPtr<IDWriteTextLayout> layout;
    m_dwriteFactory->CreateTextLayout(L"M", 1, m_textFormat.Get(), 1000.0f, 1000.0f, &layout);
    if (!layout) return;

    DWRITE_TEXT_METRICS metrics;
    layout->GetMetrics(&metrics);
    m_cellWidth = metrics.width;
    m_cellHeight = metrics.height * m_config.lineHeight;
}

void TerminalRenderer::setConfig(const RendererConfig& config) {
    m_config = config;
    createTextFormat();
    measureCellSize();
}

void TerminalRenderer::setTheme(const TerminalTheme& theme) {
    m_theme = theme;
    m_brushCache.clear();
}

void TerminalRenderer::render(const TerminalBuffer& buffer, int cursorRow, int cursorCol) {
    if (!m_d2dContext) return;

    m_d2dContext->BeginDraw();
    m_d2dContext->Clear(colorFromIndex(0)); // background color

    int rows = buffer.rows();
    for (int r = 0; r < rows; ++r) {
        renderRow(buffer, r);
    }

    renderCursor(cursorRow, cursorCol);

    m_d2dContext->EndDraw();
    if (m_swapChain) {
        DXGI_PRESENT_PARAMETERS params = {};
        m_swapChain->Present1(1, 0, &params);
    }
}

void TerminalRenderer::renderRow(const TerminalBuffer& buffer, int row) {
    int cols = buffer.cols();
    for (int col = 0; col < cols; ++col) {
        auto cell = buffer.getCell(row, col);
        if (cell.character == L' ' && cell.bgColor == 0) continue;

        float x = col * m_cellWidth;
        float y = row * m_cellHeight;

        // Background
        if (cell.bgColor != 0) {
            auto* bgBrush = getBrush(cell.bgColor);
            if (bgBrush) {
                D2D1_RECT_F rect = { x, y, x + m_cellWidth, y + m_cellHeight };
                m_d2dContext->FillRectangle(rect, bgBrush);
            }
        }

        // Character
        if (cell.character != L' ') {
            auto* fgBrush = getBrush(cell.fgColor);
            if (fgBrush && m_textFormat) {
                D2D1_RECT_F rect = { x, y, x + m_cellWidth, y + m_cellHeight };
                wchar_t str[2] = { cell.character, 0 };
                m_d2dContext->DrawText(str, 1, m_textFormat.Get(), rect, fgBrush);
            }
        }
    }
}

void TerminalRenderer::renderCursor(int row, int col) {
    float x = col * m_cellWidth;
    float y = row * m_cellHeight;
    auto* brush = getBrush(7); // cursor color (white)
    if (!brush) return;

    switch (m_config.cursorStyle) {
    case CursorStyle::Block: {
        D2D1_RECT_F rect = { x, y, x + m_cellWidth, y + m_cellHeight };
        m_d2dContext->FillRectangle(rect, brush);
        break;
    }
    case CursorStyle::Underline: {
        D2D1_RECT_F rect = { x, y + m_cellHeight - 2, x + m_cellWidth, y + m_cellHeight };
        m_d2dContext->FillRectangle(rect, brush);
        break;
    }
    case CursorStyle::Bar: {
        D2D1_RECT_F rect = { x, y, x + 2, y + m_cellHeight };
        m_d2dContext->FillRectangle(rect, brush);
        break;
    }
    }
}

void TerminalRenderer::resize(float width, float height) {
    m_width = width;
    m_height = height;
    // Recreate swap chain buffers on resize
    if (m_swapChain && m_d2dContext) {
        m_d2dContext->SetTarget(nullptr);
        m_targetBitmap.Reset();

        m_swapChain->ResizeBuffers(0, static_cast<UINT>(width), static_cast<UINT>(height),
            DXGI_FORMAT_UNKNOWN, 0);

        ComPtr<IDXGISurface> backBuffer;
        m_swapChain->GetBuffer(0, IID_PPV_ARGS(&backBuffer));

        D2D1_BITMAP_PROPERTIES1 bitmapProps = D2D1::BitmapProperties1(
            D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
            D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED));

        m_d2dContext->CreateBitmapFromDxgiSurface(backBuffer.Get(), &bitmapProps, &m_targetBitmap);
        m_d2dContext->SetTarget(m_targetBitmap.Get());
    }
}

int TerminalRenderer::gridCols() const {
    if (m_cellWidth <= 0) return 80;
    return static_cast<int>(m_width / m_cellWidth);
}

int TerminalRenderer::gridRows() const {
    if (m_cellHeight <= 0) return 24;
    return static_cast<int>(m_height / m_cellHeight);
}

D2D1_COLOR_F TerminalRenderer::colorFromIndex(uint32_t index) const {
    if (index < 16) return kDefaultPalette[index];
    return kDefaultPalette[7]; // fallback to white
}

ID2D1SolidColorBrush* TerminalRenderer::getBrush(uint32_t colorIndex) {
    auto it = m_brushCache.find(colorIndex);
    if (it != m_brushCache.end()) return it->second.Get();

    if (!m_d2dContext) return nullptr;
    ComPtr<ID2D1SolidColorBrush> brush;
    m_d2dContext->CreateSolidColorBrush(colorFromIndex(colorIndex), &brush);
    if (!brush) return nullptr;
    m_brushCache[colorIndex] = brush;
    return brush.Get();
}

} // namespace VTerminal
