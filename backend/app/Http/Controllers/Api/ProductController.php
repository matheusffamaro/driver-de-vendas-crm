<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Product::with('category');

        if ($user?->tenant_id) {
            $query->where('tenant_id', $user->tenant_id);
        }

        // Apply filters
        if ($request->has('filter.search') || $request->has('search')) {
            $search = $request->input('filter.search', $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('sku', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        if ($request->has('filter.category_id') || $request->has('category_id')) {
            $categoryId = $request->input('filter.category_id', $request->input('category_id'));
            $query->where('category_id', $categoryId);
        }

        if ($request->has('filter.is_active')) {
            $query->where('is_active', $request->boolean('filter.is_active'));
        } elseif ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('filter.low_stock')) {
            $query->whereColumn('stock', '<=', 'min_stock');
        }

        if ($request->has('filter.type') || $request->has('type')) {
            $type = $request->input('filter.type', $request->input('type'));
            $query->where('type', $type);
        }

        $products = $query->orderBy('name')->paginate($request->get('per_page', 20));

        // Calculate summary statistics (always from all products, not filtered)
        $summaryQuery = Product::query();
        if ($user?->tenant_id) {
            $summaryQuery->where('tenant_id', $user->tenant_id);
        }

        $totalProducts = (clone $summaryQuery)->count();
        $activeProducts = (clone $summaryQuery)->where('is_active', true)->count();
        $lowStockCount = (clone $summaryQuery)->whereColumn('stock', '<=', 'min_stock')
            ->where('min_stock', '>', 0)
            ->count();
        $totalStockValue = (clone $summaryQuery)->where('is_active', true)
            ->selectRaw('COALESCE(SUM(price * stock), 0) as total')
            ->value('total') ?? 0;
        $inactiveProducts = (clone $summaryQuery)->where('is_active', false)->count();

        return response()->json([
            'success' => true,
            'data' => $products->items(),
            'summary' => [
                'total_products' => $totalProducts,
                'active_products' => $activeProducts,
                'inactive_products' => $inactiveProducts,
                'low_stock_count' => $lowStockCount,
                'total_stock_value' => (float) $totalStockValue,
            ],
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'nullable|in:product,service',
            'description' => 'nullable|string',
            'sku' => 'nullable|string|max:50',
            'price' => 'required|numeric|min:0',
            'cost' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'category_id' => 'nullable|uuid|exists:product_categories,id',
            'unit' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'images' => 'nullable|array',
            'attributes' => 'nullable|array',
            'stock_quantity' => 'nullable|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'track_stock' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $data = $request->all();
        if (array_key_exists('stock_quantity', $data) && !array_key_exists('stock', $data)) {
            $data['stock'] = $data['stock_quantity'];
        }
        if (array_key_exists('min_stock', $data) && ($data['track_stock'] ?? true) === false) {
            $data['min_stock'] = 0;
        }
        $data['type'] = $data['type'] ?? 'product';
        if ($user?->tenant_id) {
            $data['tenant_id'] = $user->tenant_id;
        }

        $product = Product::create($data);

        return response()->json([
            'success' => true,
            'data' => $product->load('category'),
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $product = Product::with('category')->findOrFail($id);
        $user = request()->user();
        if ($user?->tenant_id && $product->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $user = $request->user();
        if ($user?->tenant_id && $product->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:product,service',
            'description' => 'sometimes|nullable|string',
            'sku' => 'sometimes|nullable|string|max:50',
            'price' => 'sometimes|numeric|min:0',
            'cost' => 'sometimes|nullable|numeric|min:0',
            'stock' => 'sometimes|nullable|integer|min:0',
            'category_id' => 'sometimes|nullable|uuid|exists:product_categories,id',
            'unit' => 'sometimes|nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
            'images' => 'sometimes|nullable|array',
            'attributes' => 'sometimes|nullable|array',
            'stock_quantity' => 'sometimes|nullable|integer|min:0',
            'min_stock' => 'sometimes|nullable|integer|min:0',
            'track_stock' => 'sometimes|nullable|boolean',
        ]);

        $data = $request->all();
        if (array_key_exists('stock_quantity', $data) && !array_key_exists('stock', $data)) {
            $data['stock'] = $data['stock_quantity'];
        }
        if (array_key_exists('min_stock', $data) && ($data['track_stock'] ?? true) === false) {
            $data['min_stock'] = 0;
        }
        $product->update($data);

        return response()->json([
            'success' => true,
            'data' => $product->fresh()->load('category'),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $user = request()->user();
        if ($user?->tenant_id && $product->tenant_id !== $user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Acesso negado.',
            ], 403);
        }
        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
        ]);
    }

    // Categories
    public function categories(Request $request): JsonResponse
    {
        // SECURITY: Filter by tenant
        $categories = ProductCategory::where('tenant_id', $request->user()->tenant_id)
            ->withCount('products')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'is_active' => 'boolean',
        ]);

        // SECURITY: Set tenant_id
        $category = ProductCategory::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $request->name,
            'description' => $request->description,
            'color' => $request->color,
            'is_active' => $request->get('is_active', true),
        ]);

        return response()->json([
            'success' => true,
            'data' => $category,
        ], 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $category = ProductCategory::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'color' => 'sometimes|nullable|string|max:7',
            'is_active' => 'sometimes|boolean',
        ]);

        $category->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $category->fresh(),
        ]);
    }

    public function destroyCategory(Request $request, string $id): JsonResponse
    {
        // SECURITY: Verify tenant ownership
        $category = ProductCategory::where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully',
        ]);
    }

    public function exportCsv(Request $request)
    {
        $user = $request->user();
        $query = Product::with('category');
        if ($user?->tenant_id) {
            $query->where('tenant_id', $user->tenant_id);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $filename = 'products-services-' . now()->format('Ymd-His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $columns = [
            'name',
            'type',
            'sku',
            'description',
            'price',
            'cost',
            'unit',
            'stock',
            'min_stock',
            'category',
            'is_active',
        ];

        $callback = function () use ($query, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);

            $query->orderBy('name')->chunk(200, function ($products) use ($handle) {
                foreach ($products as $product) {
                    fputcsv($handle, [
                        $product->name,
                        $product->type,
                        $product->sku,
                        $product->description,
                        $product->price,
                        $product->cost,
                        $product->unit,
                        $product->stock,
                        $product->min_stock,
                        $product->category?->name,
                        $product->is_active ? '1' : '0',
                    ]);
                }
            });

            fclose($handle);
        };

        return response()->streamDownload($callback, $filename, $headers);
    }

    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $user = $request->user();
        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        if (!$handle) {
            return response()->json([
                'success' => false,
                'message' => 'Não foi possível ler o arquivo.',
            ], 422);
        }

        $header = fgetcsv($handle);
        if (!$header) {
            fclose($handle);
            return response()->json([
                'success' => false,
                'message' => 'Arquivo CSV vazio.',
            ], 422);
        }

        $map = array_flip(array_map('strtolower', $header));
        $created = 0;
        $updated = 0;
        $errors = [];

        while (($row = fgetcsv($handle)) !== false) {
            try {
                $name = $row[$map['name'] ?? -1] ?? null;
                if (!$name) {
                    continue;
                }

                $type = strtolower($row[$map['type'] ?? -1] ?? 'product');
                if (!in_array($type, ['product', 'service'], true)) {
                    $type = 'product';
                }

                $categoryName = $row[$map['category'] ?? -1] ?? null;
                $categoryId = null;
                if ($categoryName && $user?->tenant_id) {
                    $category = ProductCategory::firstOrCreate(
                        [
                            'name' => $categoryName,
                            'tenant_id' => $user->tenant_id
                        ],
                        [
                            'color' => '#3b82f6',
                            'is_active' => true
                        ]
                    );
                    $categoryId = $category->id;
                }

                // Parse cost field (can be empty)
                $costValue = $row[$map['cost'] ?? -1] ?? null;
                $cost = null;
                if ($costValue !== null && $costValue !== '') {
                    $cost = (float) $costValue;
                }

                $data = [
                    'name' => $name,
                    'type' => $type,
                    'sku' => $row[$map['sku'] ?? -1] ?? null,
                    'description' => $row[$map['description'] ?? -1] ?? null,
                    'price' => (float) ($row[$map['price'] ?? -1] ?? 0),
                    'cost' => $cost,
                    'unit' => $row[$map['unit'] ?? -1] ?? 'un',
                    'stock' => (int) ($row[$map['stock'] ?? -1] ?? 0),
                    'min_stock' => (int) ($row[$map['min_stock'] ?? -1] ?? 0),
                    'category_id' => $categoryId,
                    'is_active' => (($row[$map['is_active'] ?? -1] ?? '1') === '1'),
                ];

                if ($user?->tenant_id) {
                    $data['tenant_id'] = $user->tenant_id;
                }

                $product = Product::updateOrCreate(
                    ['name' => $data['name'], 'tenant_id' => $data['tenant_id'] ?? null],
                    $data
                );

                if ($product->wasRecentlyCreated) {
                    $created++;
                } else {
                    $updated++;
                }
            } catch (\Throwable $e) {
                $errors[] = $e->getMessage();
            }
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'message' => 'Importação concluída.',
            'data' => [
                'created' => $created,
                'updated' => $updated,
                'errors' => $errors,
            ],
        ]);
    }

    public function units(): JsonResponse
    {
        $units = [
            'un' => 'Unidade',
            'pc' => 'Peça',
            'cx' => 'Caixa',
            'kg' => 'Quilograma',
            'g' => 'Grama',
            'l' => 'Litro',
            'ml' => 'Mililitro',
            'm' => 'Metro',
            'cm' => 'Centímetro',
            'm2' => 'Metro Quadrado',
            'm3' => 'Metro Cúbico',
            'par' => 'Par',
            'dz' => 'Dúzia',
            'hr' => 'Hora',
            'dia' => 'Dia',
            'mes' => 'Mês',
            'srv' => 'Serviço',
        ];

        return response()->json([
            'success' => true,
            'data' => $units,
        ]);
    }
}
