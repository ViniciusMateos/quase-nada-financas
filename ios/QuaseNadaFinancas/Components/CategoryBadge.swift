import SwiftUI

struct CategoryBadge: View {
    let category: Category
    var isSelected: Bool = false

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(isSelected ? Color.brandPrimaryAction : Color.brandPrimaryTint)
                    .frame(width: 56, height: 56)
                Image(systemName: category.icon)
                    .font(.title3)
                    .foregroundColor(isSelected ? .white : .brandPrimaryAction)
            }
            Text(category.name)
                .font(.caption)
                .foregroundColor(.brandTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
    }
}
